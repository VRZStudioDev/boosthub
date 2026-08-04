import SwiftUI

#if canImport(Lottie)
import Lottie
#endif

#if canImport(ZIPFoundation)
import ZIPFoundation
#endif

struct LoginView: View {
    @EnvironmentObject private var auth: SupabaseAuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showSignUp = false
    @State private var showPassword = false

    private var boostLottieURL: URL? {
        if let direct = Bundle.main.url(forResource: "Boost", withExtension: "lottie") {
            return direct
        }
        if let flat = Bundle.main.urls(forResourcesWithExtension: "lottie", subdirectory: nil)?.first(where: { $0.lastPathComponent == "Boost.lottie" }) {
            return flat
        }
        guard let resourceURL = Bundle.main.resourceURL,
              let enumerator = FileManager.default.enumerator(at: resourceURL, includingPropertiesForKeys: nil) else {
            return nil
        }
        for case let fileURL as URL in enumerator where fileURL.lastPathComponent == "Boost.lottie" {
            return fileURL
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.appDarkBg, Color(red: 7 / 255, green: 12 / 255, blue: 28 / 255)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                Circle()
                    .fill(Color.appBlue.opacity(0.22))
                    .frame(width: 280, height: 280)
                    .blur(radius: 70)
                    .offset(x: -110, y: -290)

                Circle()
                    .fill(Color.appGreen.opacity(0.15))
                    .frame(width: 220, height: 220)
                    .blur(radius: 80)
                    .offset(x: 140, y: -220)

                ScrollView {
                    VStack(spacing: 22) {
                        header

                        VStack(spacing: 14) {
                            AuthField(title: "Email", text: $email, isSecure: false, keyboard: .emailAddress)
                            AuthPasswordField(title: "Password", text: $password, showPassword: $showPassword)
                        }
                        .padding(16)
                        .background(Color.appCard.opacity(0.72))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                        if let error = auth.errorMessage {
                            AuthBanner(text: error, color: Color.appRed)
                        }
                        if let info = auth.infoMessage {
                            AuthBanner(text: info, color: Color.appGreen)
                        }

                        primaryButton

                        Button {
                            Task { await auth.sendMagicLink(email: email) }
                        } label: {
                            Text("Email me a Magic Link")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(Color.appBlue)
                        }
                        .disabled(email.isEmpty || auth.isLoading)

                        Divider().background(Color.white.opacity(0.1))

                        Button {
                            showSignUp = true
                        } label: {
                            Text("No account? Sign Up")
                                .font(.subheadline)
                                .foregroundColor(Color.appMuted)
                        }
                    }
                    .padding(24)
                    .padding(.top, 20)
                }
            }
            .navigationDestination(isPresented: $showSignUp) {
                SignUpView()
            }
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(spacing: 10) {
            Group {
                if let lottieURL = boostLottieURL {
                    BoostLottieView(fileURL: lottieURL)
                } else {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 58, weight: .bold))
                        .foregroundColor(Color.appBlue)
                        .padding(.top, 12)
                }
            }
            .frame(height: 165)

            Text("BoostHub")
                .font(.largeTitle.weight(.bold))
                .foregroundColor(.white)
            Text("Sign in to manage your protection")
                .font(.subheadline)
                .foregroundColor(Color.appMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 22)
        .padding(.bottom, 10)
    }

    private var primaryButton: some View {
        Button {
            Task { await auth.signIn(email: email, password: password) }
        } label: {
            ZStack {
                if auth.isLoading {
                    ProgressView().tint(.white)
                } else {
                    Text("Sign In").font(.headline.weight(.bold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
        }
        .background(Color.appBlue)
        .foregroundColor(.white)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .disabled(email.isEmpty || password.isEmpty || auth.isLoading)
    }
}

struct AuthField: View {
    let title: String
    @Binding var text: String
    let isSecure: Bool
    let keyboard: UIKeyboardType

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            Group {
                if isSecure {
                    SecureField("", text: $text)
                        .textInputAutocapitalization(.never)
                } else {
                    TextField("", text: $text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .foregroundColor(.white)
            .padding(14)
            .background(Color.black.opacity(0.28))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

struct AuthPasswordField: View {
    let title: String
    @Binding var text: String
    @Binding var showPassword: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            HStack(spacing: 8) {
                Group {
                    if showPassword {
                        TextField("", text: $text)
                    } else {
                        SecureField("", text: $text)
                    }
                }
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

                Button {
                    showPassword.toggle()
                } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .foregroundColor(Color.appMuted)
                }
            }
            .foregroundColor(.white)
            .padding(14)
            .background(Color.black.opacity(0.28))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

struct AuthBanner: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.footnote.weight(.medium))
            .foregroundColor(color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(color.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct BoostLottieView: UIViewRepresentable {
    let fileURL: URL

    func makeUIView(context: Context) -> UIView {
        #if canImport(Lottie) && canImport(ZIPFoundation)
        let container = UIView()
        container.backgroundColor = .clear

        let animationView = LottieAnimationView()
        animationView.backgroundBehavior = .pauseAndRestore
        animationView.contentMode = .scaleAspectFit
        animationView.loopMode = .loop
        animationView.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(animationView)
        NSLayoutConstraint.activate([
            animationView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            animationView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            animationView.topAnchor.constraint(equalTo: container.topAnchor),
            animationView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        if let animation = loadAnimationFromDotLottie(fileURL: fileURL) {
            animationView.animation = animation
            animationView.play()
        }

        return container
        #else
        let imageView = UIImageView(image: UIImage(systemName: "shield.lefthalf.filled"))
        imageView.tintColor = UIColor(Color.appBlue)
        imageView.contentMode = .scaleAspectFit
        return imageView
        #endif
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    #if canImport(Lottie) && canImport(ZIPFoundation)
    private func loadAnimationFromDotLottie(fileURL: URL) -> LottieAnimation? {
        let extractionRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("boosthub-dotlottie", isDirectory: true)
        let extractionFolder = extractionRoot
            .appendingPathComponent(UUID().uuidString, isDirectory: true)

        do {
            try FileManager.default.createDirectory(at: extractionFolder, withIntermediateDirectories: true)
            guard let archive = Archive(url: fileURL, accessMode: .read) else {
                return nil
            }

            for entry in archive {
                let destination = extractionFolder.appendingPathComponent(entry.path)
                let parent = destination.deletingLastPathComponent()
                try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
                _ = try archive.extract(entry, to: destination)
            }

            guard let jsonURL = findFirstAnimationJSON(in: extractionFolder) else {
                return nil
            }

            return LottieAnimation.filepath(jsonURL.path)
        } catch {
            return nil
        }
    }

    private func findFirstAnimationJSON(in folder: URL) -> URL? {
        guard let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: nil) else {
            return nil
        }

        for case let url as URL in enumerator {
            guard url.pathExtension.lowercased() == "json" else { continue }
            let name = url.lastPathComponent.lowercased()
            if name == "manifest.json" { continue }
            return url
        }
        return nil
    }
    #endif
}
