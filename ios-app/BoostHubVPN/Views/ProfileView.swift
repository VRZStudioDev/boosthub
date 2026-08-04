import SwiftUI
import NetworkExtension

private enum SettingsPane: String, CaseIterable, Identifiable {
    case main = "Main"
    case certificates = "Certificates"
    case sslProxy = "SSL Proxying List"

    var id: String { rawValue }
}

struct ProfileView: View {
    @ObservedObject var vm: VPNManager
    @EnvironmentObject private var auth: SupabaseAuthManager
    @EnvironmentObject private var proxyTools: ProxyToolsStore
    @Environment(\.openURL) private var openURL

    @State private var showDeleteConfirm = false
    @State private var showAuthSheet = false
    @State private var selectedPane: SettingsPane = .main
    @State private var newDomain = ""

    private var isActive: Bool {
        auth.licenseStatus.lowercased() == "active"
    }

    private var isVPNRunning: Bool {
        vm.status == .connected || vm.status == .connecting || vm.status == .reasserting
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appDarkBg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        toolsTabsCard

                        switch selectedPane {
                        case .main:
                            mainPane
                        case .certificates:
                            certificatesPane
                        case .sslProxy:
                            sslProxyPane
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                if auth.isAuthenticated {
                    await auth.loadProfile()
                }
            }
            .alert("Delete Account", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task { await auth.deleteAccount() }
                }
            } message: {
                Text("This permanently deletes your account and cancels your subscription. This cannot be undone.")
            }
            .sheet(isPresented: $showAuthSheet) {
                LoginView()
                    .environmentObject(auth)
            }
            .onChange(of: auth.isAuthenticated) { _, isAuthenticated in
                if isAuthenticated {
                    showAuthSheet = false
                    Task { await auth.loadProfile() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var toolsTabsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TOOLS MENU")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            Picker("Settings Menu", selection: $selectedPane) {
                ForEach(SettingsPane.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var mainPane: some View {
        VStack(spacing: 16) {
            if auth.isAuthenticated {
                accountCard
                subscriptionCard
                actionsCard
            } else {
                guestCard
                guestActions
            }
        }
    }

    private var certificatesPane: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 14) {
                Text("OVERVIEW")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color.appMuted)

                HStack {
                    Text("Status")
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    Text(isVPNRunning ? "VPN is running" : "VPN is not running")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(isVPNRunning ? Color.appGreen : Color.appRed)
                }

                if !isVPNRunning {
                    Button {
                        vm.setVPNEnabled(true)
                    } label: {
                        Text("Start VPN")
                            .font(.headline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                    }
                    .background(Color.appBlue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                Text("VPN must be running before SSL certificate installation.")
                    .font(.footnote)
                    .foregroundColor(Color.appMuted)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 14) {
                Text("CA CERTIFICATE")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color.appMuted)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Name")
                        .font(.caption)
                        .foregroundColor(Color.appMuted)
                    Text("BoostHub CA")
                        .font(.headline)
                        .foregroundColor(.white)
                }

                Button {
                    if let url = URL(string: "http://proxy.man/ssl") {
                        openURL(url)
                    }
                } label: {
                    Text("Download Certificate")
                        .font(.headline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                }
                .background(Color.appBlue)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private var sslProxyPane: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 14) {
                Text("SSL PROXYING")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color.appMuted)

                Toggle(isOn: Binding(
                    get: { proxyTools.sslProxyEnabled },
                    set: { proxyTools.setEnabled($0) }
                )) {
                    Text("Enabled")
                        .foregroundColor(.white)
                }
                .tint(Color.appGreen)

                Text("Select HTTPS traffic in Diagnostics to enable SSL Proxying for a specific host.")
                    .font(.footnote)
                    .foregroundColor(Color.appMuted)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 14) {
                Text("INCLUDE")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color.appMuted)

                HStack(spacing: 8) {
                    TextField("Add domain (e.g. api.example.com)", text: $newDomain)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .foregroundColor(.white)
                        .padding(12)
                        .background(Color.black.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    Button("Add") {
                        proxyTools.addDomain(newDomain)
                        newDomain = ""
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.appBlue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                if proxyTools.includeDomains.isEmpty {
                    Text("Empty List")
                        .font(.subheadline)
                        .foregroundColor(Color.appMuted)
                } else {
                    VStack(spacing: 8) {
                        ForEach(proxyTools.includeDomains, id: \.self) { host in
                            HStack {
                                Text(host)
                                    .font(.subheadline)
                                    .foregroundColor(.white)
                                Spacer()
                                Button {
                                    proxyTools.removeDomain(host)
                                } label: {
                                    Image(systemName: "trash")
                                        .foregroundColor(Color.appRed)
                                }
                            }
                            .padding(12)
                            .background(Color.black.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private var guestCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GUEST MODE")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: 34))
                    .foregroundColor(Color.appBlue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("You are using BoostHub as Guest")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("VPN features remain available")
                        .font(.caption)
                        .foregroundColor(Color.appMuted)
                }
                Spacer()
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var guestActions: some View {
        VStack(spacing: 12) {
            Button {
                showAuthSheet = true
            } label: {
                Text("Sign In or Create Account")
                    .font(.headline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .background(Color.appBlue)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ACCOUNT")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 34))
                    .foregroundColor(Color.appBlue)
                VStack(alignment: .leading, spacing: 2) {
                    Text(auth.userEmail ?? "Unknown")
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text("Signed in")
                        .font(.caption)
                        .foregroundColor(Color.appMuted)
                }
                Spacer()
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var subscriptionCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("SUBSCRIPTION")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            HStack {
                Text("License")
                    .font(.subheadline)
                    .foregroundColor(.white)
                Spacer()
                Text(isActive ? "Active" : "Inactive")
                    .font(.caption.weight(.bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(isActive ? Color.appGreen : Color.appRed)
                    .clipShape(Capsule())
            }

            Button {
                Task {
                    if let url = await auth.createPortalSession() {
                        openURL(url)
                    }
                }
            } label: {
                Text("Manage Subscription")
                    .font(.headline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .background(Color.appBlue)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .disabled(auth.isLoading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var actionsCard: some View {
        VStack(spacing: 12) {
            Button {
                Task { await auth.signOut() }
            } label: {
                Text("Sign Out")
                    .font(.headline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .background(Color.white.opacity(0.08))
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Button {
                showDeleteConfirm = true
            } label: {
                Text("Delete Account")
                    .font(.headline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .background(Color.appRed.opacity(0.15))
            .foregroundColor(Color.appRed)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}
