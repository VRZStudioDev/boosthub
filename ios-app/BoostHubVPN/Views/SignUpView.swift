import SwiftUI

struct SignUpView: View {
    @EnvironmentObject private var auth: SupabaseAuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    private var passwordsMatch: Bool {
        !password.isEmpty && password == confirmPassword
    }

    var body: some View {
        ZStack {
            Color.appDarkBg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 22) {
                    VStack(spacing: 8) {
                        Text("Create Account")
                            .font(.largeTitle.weight(.bold))
                            .foregroundColor(.white)
                        Text("Start protecting your acceptance rate")
                            .font(.subheadline)
                            .foregroundColor(Color.appMuted)
                    }
                    .padding(.top, 24)

                    VStack(spacing: 14) {
                        AuthField(title: "Email", text: $email, isSecure: false, keyboard: .emailAddress)
                        AuthField(title: "Password", text: $password, isSecure: true, keyboard: .default)
                        AuthField(title: "Confirm Password", text: $confirmPassword, isSecure: true, keyboard: .default)
                    }

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        AuthBanner(text: "Passwords do not match", color: Color.appRed)
                    }
                    if let error = auth.errorMessage {
                        AuthBanner(text: error, color: Color.appRed)
                    }
                    if let info = auth.infoMessage {
                        AuthBanner(text: info, color: Color.appGreen)
                    }

                    Button {
                        Task { await auth.signUp(email: email, password: password) }
                    } label: {
                        ZStack {
                            if auth.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Create Account").font(.headline.weight(.bold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                    }
                    .background(Color.appBlue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .disabled(!passwordsMatch || email.isEmpty || auth.isLoading)

                    Button {
                        dismiss()
                    } label: {
                        Text("Already have an account? Sign In")
                            .font(.subheadline)
                            .foregroundColor(Color.appMuted)
                    }
                }
                .padding(24)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }
}
