import Foundation
import Security
import OSLog

private let authLog = OSLog(subsystem: "com.boosthub.vpn", category: "auth")

/// Handles Supabase GoTrue auth + profile lookups. The anon key is safe to embed in the client
/// (it is protected by row-level security); the service-role key is never used here.
@MainActor
final class SupabaseAuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userEmail: String?
    @Published var licenseStatus: String = "inactive"
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var infoMessage: String?

    private let baseURL = URL(string: "https://fphnymigmwqxsrghzvip.supabase.co")!
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaG55bWlnbXdxeHNyZ2h6dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzc3NzgsImV4cCI6MjA5ODYxMzc3OH0.vGb7y6cNCN2zagVlfB7zrwYWPkxb8R4ObowoVlG2dio"

    private let keychain = KeychainStore(service: "com.boosthub.vpn.auth")
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"

    private var accessToken: String? {
        keychain.get(accessTokenKey)
    }
    private var userId: String?

    // MARK: - Session restore

    func restore() {
        guard accessToken != nil else {
            isAuthenticated = false
            return
        }
        Task { await refreshCurrentUser() }
    }

    // MARK: - Sign up

    func signUp(email: String, password: String) async {
        await perform {
            let body = try self.encode(["email": email, "password": password])
            let (data, response) = try await self.send(
                path: "/auth/v1/signup",
                method: "POST",
                body: body
            )
            try self.assertSuccess(data: data, response: response)

            // With email confirmation on, no session is returned yet.
            if let session = try? JSONDecoder().decode(AuthSession.self, from: data),
               !session.accessToken.isEmpty {
                self.persist(session)
                await self.refreshCurrentUser()
            } else {
                self.infoMessage = "Check your email to confirm your account."
            }
        }
    }

    // MARK: - Sign in (password)

    func signIn(email: String, password: String) async {
        await perform {
            let body = try self.encode(["email": email, "password": password])
            let (data, response) = try await self.send(
                path: "/auth/v1/token?grant_type=password",
                method: "POST",
                body: body
            )
            try self.assertSuccess(data: data, response: response)

            let session = try JSONDecoder().decode(AuthSession.self, from: data)
            self.persist(session)
            await self.refreshCurrentUser()
        }
    }

    // MARK: - Magic link (email OTP)

    func sendMagicLink(email: String) async {
        await perform {
            let body = try self.encode(["email": email, "create_user": true])
            let (data, response) = try await self.send(
                path: "/auth/v1/otp",
                method: "POST",
                body: body
            )
            try self.assertSuccess(data: data, response: response)
            self.infoMessage = "Magic link sent. Check your email to log in."
        }
    }

    // MARK: - Sign out

    func signOut() async {
        if let token = accessToken {
            _ = try? await send(
                path: "/auth/v1/logout",
                method: "POST",
                body: Data("{}".utf8),
                bearer: token
            )
        }
        clearSession()
    }

    // MARK: - Delete account

    func deleteAccount() async {
        await perform {
            guard let token = self.accessToken else {
                throw AuthError.message("Not signed in")
            }
            let (data, response) = try await self.send(
                path: "/functions/v1/delete-account",
                method: "POST",
                body: Data("{}".utf8),
                bearer: token
            )
            try self.assertSuccess(data: data, response: response)
            self.clearSession()
        }
    }

    // MARK: - Manage subscription (Stripe portal)

    func createPortalSession() async -> URL? {
        guard let token = accessToken else {
            errorMessage = "Not signed in"
            return nil
        }
        do {
            let (data, response) = try await send(
                path: "/functions/v1/create-portal-session",
                method: "POST",
                body: Data("{}".utf8),
                bearer: token
            )
            try assertSuccess(data: data, response: response)
            let portal = try JSONDecoder().decode(PortalResponse.self, from: data)
            return URL(string: portal.url)
        } catch {
            errorMessage = readableError(error)
            return nil
        }
    }

    // MARK: - Current user + profile

    private func refreshCurrentUser() async {
        guard let token = accessToken else {
            clearSession()
            return
        }
        do {
            let (data, response) = try await send(
                path: "/auth/v1/user",
                method: "GET",
                body: nil,
                bearer: token
            )
            try assertSuccess(data: data, response: response)
            let user = try JSONDecoder().decode(AuthUser.self, from: data)
            userId = user.id
            userEmail = user.email
            isAuthenticated = true
            await loadProfile()
        } catch {
            clearSession()
        }
    }

    func loadProfile() async {
        guard let token = accessToken, let uid = userId else { return }
        do {
            let (data, response) = try await send(
                path: "/rest/v1/profiles?select=license_status,email&id=eq.\(uid)",
                method: "GET",
                body: nil,
                bearer: token
            )
            try assertSuccess(data: data, response: response)
            let rows = try JSONDecoder().decode([ProfileRow].self, from: data)
            if let profile = rows.first {
                licenseStatus = profile.licenseStatus ?? "inactive"
                if let email = profile.email { userEmail = email }
            }
        } catch {
            os_log(.error, log: authLog, "Profile load failed: %{public}@", error.localizedDescription)
        }
    }

    // MARK: - Networking

    private func send(
        path: String,
        method: String,
        body: Data?,
        bearer: String? = nil
    ) async throws -> (Data, URLResponse) {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw AuthError.message("Invalid URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(bearer ?? anonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = body
        return try await URLSession.shared.data(for: request)
    }

    private func assertSuccess(data: Data, response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.message("No response")
        }
        guard (200...299).contains(http.statusCode) else {
            if let apiError = try? JSONDecoder().decode(GoTrueError.self, from: data) {
                throw AuthError.message(apiError.displayMessage)
            }
            throw AuthError.message("Request failed (\(http.statusCode))")
        }
    }

    private func encode(_ dict: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: dict)
    }

    // MARK: - Session persistence

    private func persist(_ session: AuthSession) {
        keychain.set(session.accessToken, key: accessTokenKey)
        if let refresh = session.refreshToken {
            keychain.set(refresh, key: refreshTokenKey)
        }
        userId = session.user?.id
        userEmail = session.user?.email
    }

    private func clearSession() {
        keychain.delete(accessTokenKey)
        keychain.delete(refreshTokenKey)
        userId = nil
        userEmail = nil
        licenseStatus = "inactive"
        isAuthenticated = false
    }

    // MARK: - Helpers

    private func perform(_ work: @escaping () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        infoMessage = nil
        defer { isLoading = false }
        do {
            try await work()
        } catch {
            errorMessage = readableError(error)
        }
    }

    private func readableError(_ error: Error) -> String {
        if case let AuthError.message(text) = error {
            return text
        }
        return error.localizedDescription
    }
}

// MARK: - Models

private struct AuthSession: Decodable {
    let accessToken: String
    let refreshToken: String?
    let user: AuthUser?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

private struct AuthUser: Decodable {
    let id: String
    let email: String?
}

private struct ProfileRow: Decodable {
    let licenseStatus: String?
    let email: String?

    enum CodingKeys: String, CodingKey {
        case licenseStatus = "license_status"
        case email
    }
}

private struct PortalResponse: Decodable {
    let url: String
}

private struct GoTrueError: Decodable {
    let error: String?
    let errorDescription: String?
    let msg: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
        case msg
        case message
    }

    var displayMessage: String {
        errorDescription ?? message ?? msg ?? error ?? "Something went wrong"
    }
}

private enum AuthError: Error {
    case message(String)
}

// MARK: - Keychain

private struct KeychainStore {
    let service: String

    func set(_ value: String, key: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
