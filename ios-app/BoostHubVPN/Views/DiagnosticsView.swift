import SwiftUI
import NetworkExtension

/// Legitimate diagnostics screen: tunnel lifecycle + captured HTTPS flow summaries.
struct DiagnosticsView: View {
    @ObservedObject var vm: VPNManager
    @EnvironmentObject private var proxyTools: ProxyToolsStore

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appDarkBg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        statusCard
                        eventsCard
                        httpsTrafficCard
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Diagnostics")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CONNECTION")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            HStack(spacing: 12) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)
                Text(statusText)
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var eventsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("EVENTS")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            if vm.connectionEvents.isEmpty {
                Text("No connection events yet")
                    .font(.subheadline)
                    .foregroundColor(Color.appMuted)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 10) {
                    ForEach(vm.connectionEvents) { event in
                        HStack(alignment: .top, spacing: 10) {
                            Circle()
                                .fill(color(for: event.kind))
                                .frame(width: 8, height: 8)
                                .padding(.top, 5)

                            Text(event.message)
                                .font(.subheadline)
                                .foregroundColor(.white)

                            Spacer(minLength: 8)

                            Text(timeText(from: event.timestamp))
                                .font(.caption.monospacedDigit())
                                .foregroundColor(Color.appMuted)
                        }
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var httpsTrafficCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HTTPS TRAFFIC")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color.appMuted)

            if proxyTools.httpsTraffic.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("No HTTPS traffic captured yet")
                        .font(.subheadline)
                        .foregroundColor(.white)
                    Text("When flows arrive, you can open Request/Response and enable SSL Proxying for selected hosts.")
                        .font(.footnote)
                        .foregroundColor(Color.appMuted)
                }
                .padding(.vertical, 8)
            } else {
                VStack(spacing: 10) {
                    ForEach(Array(proxyTools.httpsTraffic.prefix(50))) { flow in
                        NavigationLink {
                            HTTPSFlowDetailView(flow: flow)
                                .environmentObject(proxyTools)
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                Circle()
                                    .fill(flow.encrypted ? .orange : Color.appGreen)
                                    .frame(width: 8, height: 8)
                                    .padding(.top, 6)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(flow.host)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    Text(flow.encrypted ? "Encrypted HTTPS response" : "Readable response")
                                        .font(.caption)
                                        .foregroundColor(Color.appMuted)
                                        .lineLimit(1)
                                }

                                Spacer(minLength: 8)

                                Text(timeText(from: flow.timestamp))
                                    .font(.caption.monospacedDigit())
                                    .foregroundColor(Color.appMuted)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appCard)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var statusColor: Color {
        switch vm.status {
        case .connected: return Color.appGreen
        case .connecting, .reasserting: return .orange
        case .disconnecting: return .orange
        default: return Color.gray.opacity(0.7)
        }
    }

    private var statusText: String {
        switch vm.status {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .reasserting: return "Reconnecting"
        case .disconnecting: return "Disconnecting"
        case .disconnected: return "Disconnected"
        default: return "Not Configured"
        }
    }

    private func color(for kind: VPNManager.ConnectionEvent.Kind) -> Color {
        switch kind {
        case .connected: return Color.appGreen
        case .connecting: return .orange
        case .disconnected: return Color.appRed
        case .error: return Color.appRed
        case .info: return Color.gray.opacity(0.7)
        }
    }

    private func timeText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

private enum HTTPSDetailTab: String, CaseIterable, Identifiable {
    case request = "Request"
    case response = "Response"

    var id: String { rawValue }
}

private struct HTTPSFlowDetailView: View {
    let flow: ProxyToolsStore.HTTPSFlow
    @EnvironmentObject private var proxyTools: ProxyToolsStore
    @State private var selectedTab: HTTPSDetailTab = .request

    private var bodyText: String {
        switch selectedTab {
        case .request: return flow.requestText
        case .response: return flow.responseText
        }
    }

    private var isInSSLList: Bool {
        proxyTools.includeDomains.contains(flow.host)
    }

    var body: some View {
        ZStack {
            Color.appDarkBg.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(flow.host)
                        .font(.title3.weight(.bold))
                        .foregroundColor(.white)

                    Picker("Payload", selection: $selectedTab) {
                        ForEach(HTTPSDetailTab.allCases) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading, spacing: 10) {
                        Text(flow.encrypted && selectedTab == .response ? "HTTP Response is encrypted" : "Body")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(Color.appMuted)

                        Text(bodyText.isEmpty ? "No content available" : bodyText)
                            .font(.system(size: 13, weight: .regular, design: .monospaced))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.appCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button {
                        proxyTools.enableSSLProxying(for: flow.host)
                    } label: {
                        Text(isInSSLList ? "SSL Proxying Enabled for Host" : "Enable SSL Proxying for this traffic")
                            .font(.headline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                    }
                    .background(isInSSLList ? Color.appGreen.opacity(0.8) : Color.appBlue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .padding(16)
            }
        }
        .navigationTitle("HTTPS Detail")
        .navigationBarTitleDisplayMode(.inline)
    }
}
