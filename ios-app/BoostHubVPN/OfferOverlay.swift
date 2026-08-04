import SwiftUI

extension Color {
    static let appBlue = Color(red: 0 / 255, green: 122 / 255, blue: 255 / 255)
    static let appDarkBg = Color(red: 10 / 255, green: 14 / 255, blue: 33 / 255)
    static let appCard = Color(red: 22 / 255, green: 27 / 255, blue: 44 / 255)
    static let appGreen = Color(red: 52 / 255, green: 199 / 255, blue: 89 / 255)
    static let appRed = Color(red: 255 / 255, green: 59 / 255, blue: 48 / 255)
    static let appMuted = Color.white.opacity(0.65)
}

struct Badge: View {
    let icon: String
    let label: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption)
            Text(label)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
        }
        .foregroundColor(.white.opacity(0.85))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.appBlue.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct MetricBadge: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundColor(.white.opacity(0.55))
            Text(value)
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.headline.weight(.semibold))
                .foregroundColor(.white)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct OfferOverlayView: View {
    let offer: OfferModel
    let onAccept: () -> Void
    let onDecline: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var progress: Double = 1
    private let tick = Timer.publish(every: 0.2, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    countdownBar
                    headerCard
                    payoutMetrics
                    pickupSection
                    dropoffSection
                    itemsSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 90)
            }
            .background(Color.appDarkBg.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) {
                actionButtons
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 12)
                    .background(Color.appDarkBg.opacity(0.97))
            }
            .navigationTitle("Order Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
            .onReceive(tick) { _ in
                updateProgress()
            }
            .onAppear {
                updateProgress()
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var countdownBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Decision Timer")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white.opacity(0.65))
                Spacer()
                Text(offer.deadlineDisplay)
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundColor(progressColor)
            }
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(progressColor)
                        .frame(width: max(0, geometry.size.width * progress))
                }
            }
            .frame(height: 8)
        }
        .padding(14)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(offer.storeName)
                        .font(.title3.weight(.bold))
                        .foregroundColor(.white)
                    if !offer.storeAddress.isEmpty {
                        Text(offer.storeAddress)
                            .font(.caption)
                            .foregroundColor(Color.appMuted)
                    }
                }
                Spacer()
                Text(offer.totalDisplay)
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundColor(Color.appGreen)
            }

            HStack(spacing: 8) {
                Badge(icon: "car.fill", label: offer.distanceDisplay)
                Badge(icon: "clock.fill", label: offer.deadlineDisplay)
                if !offer.itemCountDescription.isEmpty {
                    Badge(icon: "bag.fill", label: offer.itemCountDescription)
                }
            }
        }
        .padding(16)
        .background(Color.appCard)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var payoutMetrics: some View {
        HStack(spacing: 10) {
            MetricBadge(title: "Total", value: offer.totalDisplay)
            MetricBadge(title: "Breakdown", value: offer.payoutBreakdown)
            MetricBadge(title: "Distance", value: offer.distanceDisplay)
        }
    }

    private var pickupSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color.appBlue)
                    .frame(width: 10, height: 10)
                Text("Pickup")
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(Color.appBlue)
            }

            Text(offer.storeName)
                .font(.body.weight(.semibold))
                .foregroundColor(.white)

            if !offer.storeAddress.isEmpty {
                Text(offer.storeAddress)
                    .font(.subheadline)
                    .foregroundColor(Color.appMuted)
            }

            if !offer.pickupInstructions.isEmpty {
                Text(offer.pickupInstructions)
                    .font(.subheadline)
                    .foregroundColor(.orange)
            }
        }
        .padding(14)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var dropoffSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundColor(Color.appRed)
                Text("Dropoff")
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(Color.appRed)
            }

            if !offer.customerName.isEmpty {
                Text(offer.customerName)
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
            }

            if !offer.customerAddress.isEmpty {
                Text(offer.customerAddress)
                    .font(.subheadline)
                    .foregroundColor(Color.appMuted)
            }

            if !offer.dropoffInstructions.isEmpty {
                Text(offer.dropoffInstructions)
                    .font(.subheadline)
                    .foregroundColor(.orange)
            }
        }
        .padding(14)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var itemsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Items")
                .font(.headline.weight(.semibold))
                .foregroundColor(.white)

            if offer.items.isEmpty {
                Text("No item details available")
                    .font(.subheadline)
                    .foregroundColor(Color.appMuted)
            } else {
                ForEach(Array(offer.items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(item.quantity)x")
                            .font(.subheadline.monospacedDigit().weight(.bold))
                            .foregroundColor(.white.opacity(0.85))
                            .frame(width: 34, alignment: .leading)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)

                            if let specialInstructions = item.specialInstructions,
                               !specialInstructions.isEmpty {
                                Text(specialInstructions)
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }
                        }

                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                onDecline()
            } label: {
                Text("Decline")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .background(Color.appRed)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Button {
                onAccept()
            } label: {
                Text("Accept")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .background(Color.appGreen)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var progressColor: Color {
        if progress > 0.5 {
            return Color.appGreen
        }
        if progress > 0.2 {
            return .orange
        }
        return Color.appRed
    }

    private func updateProgress() {
        let total = offer.deadline.timeIntervalSince(offer.capturedAt)
        if total <= 0 {
            progress = 0
            return
        }
        progress = min(1, max(0, offer.deadline.timeIntervalSinceNow / total))
    }
}

struct DashboardView: View {
    @ObservedObject var vm: VPNManager
    @State private var showOfferSheet = false
    @State private var vpnSwitchValue = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    vpnStatusCard
                    currentOrderCard
                    recentHistoryCard
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .background(Color.appDarkBg.ignoresSafeArea())
            .navigationTitle("BoostHub")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Circle()
                        .fill(isConnected ? Color.appGreen : Color.gray.opacity(0.65))
                        .frame(width: 10, height: 10)
                        .accessibilityLabel(isConnected ? "VPN Connected" : "VPN Disconnected")
                }
            }
            .sheet(isPresented: $showOfferSheet) {
                if let offer = vm.latestOffer {
                    OfferOverlayView(
                        offer: offer,
                        onAccept: {
                            vm.acceptOffer(offer)
                            showOfferSheet = false
                        },
                        onDecline: {
                            vm.declineOffer(offer)
                            showOfferSheet = false
                        }
                    )
                }
            }
            .onChange(of: vm.latestOffer?.id) { _, newValue in
                showOfferSheet = newValue != nil
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            vpnSwitchValue = isConnected
        }
        .onChange(of: vm.status) { _, _ in
            vpnSwitchValue = isConnected
        }
    }

    private var isConnected: Bool {
        vm.status == .connected || vm.status == .connecting
    }

    private var isProtectionActive: Bool {
        vm.status == .connected
    }

    private var vpnToggleBinding: Binding<Bool> {
        Binding(
            get: { vpnSwitchValue },
            set: { newValue in
                vpnSwitchValue = newValue
                vm.setVPNEnabled(newValue)
            }
        )
    }

    private var vpnStatusTitle: String {
        switch vm.status {
        case .connected:
            return "Protection Active"
        case .connecting, .reasserting:
            return "Turning On..."
        case .disconnecting:
            return "Turning Off..."
        default:
            return "Protection Disabled"
        }
    }

    private var vpnStatusDescription: String {
        isConnected
            ? "VPN shield is active. You can decline low payouts with protection."
            : "Enable protection before starting your dash to keep acceptance rate safe."
    }

    private var vpnInnerBorderColor: Color {
        isProtectionActive ? Color.appGreen : Color.gray.opacity(0.7)
    }

    private var vpnImageName: String {
        isConnected ? "motoboy-active" : "motoboy-inactive"
    }

    private var vpnStatusCard: some View {
        SectionCard(title: "VPN STATUS") {
            VStack(spacing: 0) {
                Image(vpnImageName)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 222)
                    .padding(.bottom, -6)

                VStack(spacing: 14) {
                    Text(isConnected ? "Disconnect" : "Enable Protection")
                        .font(.headline.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Toggle("", isOn: vpnToggleBinding)
                    .labelsHidden()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 40)
                    .tint(Color.appGreen)
                    .scaleEffect(1.3)

                    Text(vpnStatusTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text(vpnStatusDescription)
                        .font(.footnote)
                        .foregroundColor(Color.appMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(Color.appGreen)
                        Text("Updating VPN...")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(Color.appMuted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: 18)
                    .opacity(vm.busy ? 1 : 0)
                }
                .padding(14)
                .frame(maxWidth: .infinity)
                .background(Color.appDarkBg)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(vpnInnerBorderColor, lineWidth: 2)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .animation(.easeInOut(duration: 0.3), value: vm.status)
            }
            .padding(.top, 6)
        }
        .padding(.top, 18)
    }

    private var currentOrderCard: some View {
        SectionCard(title: "CURRENT ORDER") {
            if let offer = vm.latestOffer {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(offer.storeName)
                            .font(.title3.weight(.bold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                        Spacer(minLength: 8)
                        Text(offer.totalDisplay)
                            .font(.title2.monospacedDigit().weight(.bold))
                            .foregroundColor(Color.appGreen)
                    }

                    HStack(spacing: 8) {
                        Badge(icon: "car.fill", label: offer.distanceDisplay)
                        Badge(icon: "clock.fill", label: offer.deadlineDisplay)
                        if !offer.customerName.isEmpty {
                            Badge(icon: "person.fill", label: offer.customerName)
                        }
                    }

                    if !offer.itemCountDescription.isEmpty {
                        Text("Items: \(offer.itemCountDescription)")
                            .font(.subheadline)
                            .foregroundColor(Color.appMuted)
                    }

                    if !offer.dropoffInstructions.isEmpty {
                        Text(offer.dropoffInstructions)
                            .font(.subheadline)
                            .foregroundColor(.orange)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    HStack(spacing: 12) {
                        Button {
                            vm.declineOffer(offer)
                        } label: {
                            Text("Decline")
                                .font(.headline.weight(.bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                        }
                        .background(Color.appRed)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button {
                            vm.acceptOffer(offer)
                        } label: {
                            Text("Accept")
                                .font(.headline.weight(.bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                        }
                        .background(Color.appGreen)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "tray")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundColor(Color.appMuted)
                    Text("Waiting for Orders")
                        .font(.subheadline)
                        .foregroundColor(Color.appMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            }
        }
    }

    private var recentHistoryCard: some View {
        SectionCard(title: "RECENT HISTORY") {
            let entries = Array(vm.historyEntries.prefix(5))
            if entries.isEmpty {
                Text("No recent orders yet")
                    .font(.subheadline)
                    .foregroundColor(Color.appMuted)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 10) {
                    ForEach(entries) { entry in
                        HStack(spacing: 10) {
                            Circle()
                                .fill(entry.wasAccepted ? Color.appGreen : Color.appRed)
                                .frame(width: 8, height: 8)

                            Text(entry.offer.storeName)
                                .font(.subheadline)
                                .foregroundColor(.white)
                                .lineLimit(1)

                            Spacer(minLength: 10)

                            Text(entry.offer.totalDisplay)
                                .font(.subheadline.monospacedDigit().weight(.semibold))
                                .foregroundColor(.white)

                            Text(timeText(from: entry.timestamp))
                                .font(.caption.monospacedDigit())
                                .foregroundColor(Color.appMuted)
                        }
                    }
                }
            }
        }
    }

    private func timeText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

@main
struct BoostHubVPNApp: App {
    @StateObject private var auth = SupabaseAuthManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var auth: SupabaseAuthManager

    var body: some View {
        MainTabView()
        .onAppear { auth.restore() }
    }
}

struct MainTabView: View {
    @StateObject private var vm = VPNManager()
    @StateObject private var proxyTools = ProxyToolsStore()

    var body: some View {
        TabView {
            DashboardView(vm: vm)
                .tabItem { Label("VPN", systemImage: "shield.lefthalf.filled") }

            DiagnosticsView(vm: vm)
                .environmentObject(proxyTools)
                .tabItem { Label("Diagnostics", systemImage: "waveform.path.ecg") }

            ProfileView(vm: vm)
                .environmentObject(proxyTools)
                .tabItem { Label("Settings", systemImage: "person.crop.circle") }
        }
        .tint(Color.appBlue)
    }
}
