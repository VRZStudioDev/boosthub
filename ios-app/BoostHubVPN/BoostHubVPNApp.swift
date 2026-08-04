import Foundation
import NetworkExtension
import Combine
import UserNotifications
import BackgroundTasks
import OSLog

private let log = OSLog(subsystem: "com.boosthub.vpn", category: "app")

final class VPNManager: NSObject, ObservableObject {
    @Published var status: NEVPNStatus = .invalid
    @Published var busy = false
    @Published var latestOffer: OfferModel?
    @Published var historyEntries: [HistoryEntry] = []
    @Published var alertMessage: String?
    @Published var connectionEvents: [ConnectionEvent] = []

    struct HistoryEntry: Identifiable {
        let id = UUID()
        let offer: OfferModel
        let wasAccepted: Bool
        let timestamp: Date
    }

    struct ConnectionEvent: Identifiable {
        let id = UUID()
        let message: String
        let kind: Kind
        let timestamp: Date

        enum Kind {
            case connected, connecting, disconnected, error, info
        }
    }

    private static let appGroupId = "group.com.boosthub.vpn"
    private static let offerDefaultsKey = "currentOffer"
    private static let bundleId = "com.boosthub.vpn.packet-tunnel"
    private static let backgroundTaskId = "com.boosthub.vpn.refresh"
    private static let notificationCategoryId = "BOOSTHUB_OFFER"
    private static let agreeActionId = "AGREE_ACTION"
    private static let disregardActionId = "DISREGARD_ACTION"

    private var pollSubscription: AnyCancellable?
    private var statusObserver: NSObjectProtocol?
    private var toggleWorkItem: DispatchWorkItem?
    private var busyWatchdog: DispatchWorkItem?

    override init() {
        super.init()
        configureNotifications()
        registerBackgroundTasks()
        scheduleBackgroundRefresh()
        loadStatus()
        startPolling()
        observeStatusChange()
    }

    // MARK: - Notifications

    private func configureNotifications() {
        UNUserNotificationCenter.current().delegate = self

        let agree = UNNotificationAction(identifier: Self.agreeActionId, title: "Agree", options: [.foreground])
        let disregard = UNNotificationAction(identifier: Self.disregardActionId, title: "Disregard", options: [.destructive])
        let category = UNNotificationCategory(identifier: Self.notificationCategoryId, actions: [agree, disregard], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([category])

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] _, error in
            guard let error else { return }
            DispatchQueue.main.async {
                self?.alertMessage = "Notifications denied: \(error.localizedDescription)"
            }
        }
    }

    private func notifyNewOffer(_ offer: OfferModel) {
        let content = UNMutableNotificationContent()
        content.title = "New Order: \(offer.totalDisplay)"
        content.body = "\(offer.storeName) \u{00B7} \(offer.distanceDisplay) \u{00B7} \(offer.deadlineDisplay)"
        content.sound = .default
        content.categoryIdentifier = Self.notificationCategoryId
        if let payload = try? JSONEncoder().encode(offer) {
            content.userInfo["offerPayload"] = payload
        }

        let request = UNNotificationRequest(identifier: offer.id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { [weak self] error in
            guard let error else { return }
            DispatchQueue.main.async {
                self?.alertMessage = "Notification failed: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - Background refresh

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.backgroundTaskId, using: nil) { [weak self] task in
            guard let processingTask = task as? BGProcessingTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self?.handleBackgroundRefresh(processingTask)
        }
    }

    private func scheduleBackgroundRefresh() {
        let request = BGProcessingTaskRequest(identifier: Self.backgroundTaskId)
        request.requiresNetworkConnectivity = false
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60)

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            os_log(.error, log: log, "Background schedule failed: %{public}@", error.localizedDescription)
        }
    }

    private func handleBackgroundRefresh(_ task: BGProcessingTask) {
        scheduleBackgroundRefresh()

        task.expirationHandler = { [weak self] in
            self?.pollSubscription?.cancel()
        }

        pollForOffer()
        task.setTaskCompleted(success: true)
    }

    // MARK: - Status

    private func observeStatusChange() {
        statusObserver = NotificationCenter.default.addObserver(
            forName: .NEVPNStatusDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.loadStatus()
        }
    }

    private func loadStatus() {
        NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                let current = managers?.first?.connection.status ?? .invalid
                self.recordConnectionEvent(from: self.status, to: current)
                self.status = current
                self.syncBusy(with: current)
            }
        }
    }

    private func recordConnectionEvent(from old: NEVPNStatus, to new: NEVPNStatus) {
        guard old != new else { return }

        let event: ConnectionEvent?
        switch new {
        case .connected:
            event = ConnectionEvent(message: "Tunnel connected", kind: .connected, timestamp: Date())
        case .connecting:
            event = ConnectionEvent(message: "Connecting", kind: .connecting, timestamp: Date())
        case .reasserting:
            event = ConnectionEvent(message: "Reconnecting", kind: .connecting, timestamp: Date())
        case .disconnected:
            event = ConnectionEvent(message: "Tunnel disconnected", kind: .disconnected, timestamp: Date())
        case .invalid:
            event = ConnectionEvent(message: "VPN not configured", kind: .info, timestamp: Date())
        default:
            event = nil
        }

        guard let event else { return }
        connectionEvents.insert(event, at: 0)
        if connectionEvents.count > 50 {
            connectionEvents = Array(connectionEvents.prefix(50))
        }
    }

    func toggleVPN() {
        setVPNEnabled(!(status == .connected || status == .connecting || status == .reasserting))
    }

    /// Debounced so rapid re-taps always act on the latest intent instead of queueing behind a busy flag.
    func setVPNEnabled(_ enabled: Bool) {
        toggleWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.applyVPNEnabled(enabled)
        }
        toggleWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12, execute: work)
    }

    private func applyVPNEnabled(_ enabled: Bool) {
        NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, error in
            DispatchQueue.main.async {
                guard let self else { return }

                if let error {
                    self.alertMessage = "VPN load failed: \(error.localizedDescription)"
                    return
                }

                if let mgr = managers?.first {
                    self.transition(mgr, enabled: enabled)
                } else if enabled {
                    self.createAndStartVPN()
                } else {
                    self.status = .disconnected
                }
            }
        }
    }

    private func transition(_ mgr: NETunnelProviderManager, enabled: Bool) {
        let s = mgr.connection.status

        if enabled {
            if isConnectedState(s) {
                status = s
                return
            }
            do {
                try mgr.connection.startVPNTunnel()
                status = .connecting
                syncBusy(with: .connecting)
                startBusyWatchdog()
            } catch {
                alertMessage = "Failed to start: \(error.localizedDescription)"
            }
        } else {
            if isDisconnectedState(s) {
                status = s
                return
            }
            mgr.connection.stopVPNTunnel()
            status = .disconnecting
            syncBusy(with: .disconnecting)
            startBusyWatchdog()
        }
    }

    private func createAndStartVPN() {
        let conf = NETunnelProviderProtocol()
        conf.serverAddress = "boosthub.local"
        conf.providerBundleIdentifier = Self.bundleId

        let mgr = NETunnelProviderManager()
        mgr.protocolConfiguration = conf
        mgr.localizedDescription = "BoostHub Protection"
        mgr.isEnabled = true

        mgr.saveToPreferences { [weak self] saveError in
            DispatchQueue.main.async {
                guard let self else { return }

                if saveError != nil {
                    self.alertMessage = "Save failed"
                    return
                }

                do {
                    try mgr.connection.startVPNTunnel()
                    self.status = .connecting
                    self.syncBusy(with: .connecting)
                    self.startBusyWatchdog()
                } catch {
                    self.alertMessage = "Failed to start: \(error.localizedDescription)"
                }
            }
        }
    }

    private func syncBusy(with status: NEVPNStatus) {
        switch status {
        case .connecting, .disconnecting, .reasserting:
            busy = true
        default:
            busy = false
            stopBusyWatchdog()
        }
    }

    private func startBusyWatchdog(timeout: TimeInterval = 10) {
        stopBusyWatchdog()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.busy = false
            self.loadStatus()
        }
        busyWatchdog = work
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout, execute: work)
    }

    private func stopBusyWatchdog() {
        busyWatchdog?.cancel()
        busyWatchdog = nil
    }

    private func isConnectedState(_ status: NEVPNStatus) -> Bool {
        status == .connected || status == .connecting || status == .reasserting
    }

    private func isDisconnectedState(_ status: NEVPNStatus) -> Bool {
        status == .disconnected || status == .disconnecting || status == .invalid
    }

    // MARK: - Offer actions

    func acceptOffer(_ offer: OfferModel) {
        historyEntries.insert(HistoryEntry(offer: offer, wasAccepted: true, timestamp: Date()), at: 0)
        if historyEntries.count > 20 { historyEntries = Array(historyEntries.prefix(20)) }
        sendAction("accept", offer: offer) { [weak self] response in
            os_log(.info, log: log, "Accept response: %{public}@", response ?? "nil")
            self?.latestOffer = nil
        }
    }

    func declineOffer(_ offer: OfferModel) {
        historyEntries.insert(HistoryEntry(offer: offer, wasAccepted: false, timestamp: Date()), at: 0)
        if historyEntries.count > 20 { historyEntries = Array(historyEntries.prefix(20)) }
        sendAction("decline", offer: offer) { [weak self] response in
            os_log(.info, log: log, "Decline response: %{public}@", response ?? "nil")
            self?.latestOffer = nil
        }
    }

    private func sendAction(_ action: String, offer obj: OfferModel,
                            done: @escaping (String?) -> Void) {
        NETunnelProviderManager.loadAllFromPreferences { managers, _ in
            guard let session = managers?.first?.connection as? NETunnelProviderSession else {
                DispatchQueue.main.async { done("No session") }
                return
            }

            guard let data = try? JSONSerialization.data(withJSONObject: ["action": action, "offerId": obj.assignmentId]) else {
                DispatchQueue.main.async { done(nil) }
                return
            }

            do {
                try session.sendProviderMessage(data) { response in
                    DispatchQueue.main.async {
                        done(response.flatMap { String(data: $0, encoding: .utf8) })
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    done("send failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Polling

    private func startPolling() {
        pollSubscription = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.pollForOffer()
            }
    }

    private func pollForOffer() {
        let defaults = UserDefaults(suiteName: Self.appGroupId)
        guard let data = defaults?.data(forKey: Self.offerDefaultsKey) else { return }
        guard let decoded = try? JSONDecoder().decode(OfferModel.self, from: data) else { return }
        guard decoded.id != latestOffer?.id else { return }

        let isNewOffer = latestOffer == nil
        latestOffer = decoded

        if isNewOffer {
            notifyNewOffer(decoded)
        }
    }

    deinit {
        pollSubscription?.cancel()
        toggleWorkItem?.cancel()
        stopBusyWatchdog()
        if let obs = statusObserver {
            NotificationCenter.default.removeObserver(obs)
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension VPNManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        defer { completionHandler() }

        guard let payload = response.notification.request.content.userInfo["offerPayload"] as? Data,
              let offer = try? JSONDecoder().decode(OfferModel.self, from: payload) else {
            return
        }

        switch response.actionIdentifier {
        case Self.agreeActionId:
            acceptOffer(offer)
        case Self.disregardActionId:
            declineOffer(offer)
        default:
            break
        }
    }
}

final class ProxyToolsStore: ObservableObject {
    @Published var sslProxyEnabled = false
    @Published var includeDomains: [String] = []
    @Published var httpsTraffic: [HTTPSFlow] = []

    struct HTTPSFlow: Identifiable, Codable, Hashable {
        let id: String
        let host: String
        let requestText: String
        let responseText: String
        let timestamp: Date
        let encrypted: Bool
    }

    private let appGroupId = "group.com.boosthub.vpn"
    private let enabledKey = "sslProxyEnabled"
    private let domainsKey = "sslProxyIncludeDomains"
    private let trafficDataKey = "vpnHttpsTrafficData"
    private let trafficStringKey = "vpnHttpsTraffic"
    private var pollSubscription: AnyCancellable?

    init() {
        loadState()
        startPolling()
    }

    func setEnabled(_ enabled: Bool) {
        sslProxyEnabled = enabled
        defaults()?.set(enabled, forKey: enabledKey)
    }

    func addDomain(_ host: String) {
        let normalized = normalize(host)
        guard !normalized.isEmpty else { return }
        guard !includeDomains.contains(normalized) else { return }
        includeDomains.append(normalized)
        includeDomains.sort()
        defaults()?.set(includeDomains, forKey: domainsKey)
    }

    func removeDomain(_ host: String) {
        includeDomains.removeAll { $0 == host }
        defaults()?.set(includeDomains, forKey: domainsKey)
    }

    func enableSSLProxying(for host: String) {
        addDomain(host)
        setEnabled(true)
    }

    private func loadState() {
        let store = defaults()
        sslProxyEnabled = store?.bool(forKey: enabledKey) ?? false
        includeDomains = store?.stringArray(forKey: domainsKey) ?? []
        loadTraffic()
    }

    private func startPolling() {
        pollSubscription = Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.loadTraffic()
            }
    }

    private func loadTraffic() {
        let store = defaults()

        if let data = store?.data(forKey: trafficDataKey),
           let flows = try? JSONDecoder().decode([HTTPSFlow].self, from: data) {
            if flows != httpsTraffic {
                httpsTraffic = flows.sorted(by: { $0.timestamp > $1.timestamp })
            }
            return
        }

        let lines = store?.stringArray(forKey: trafficStringKey) ?? []
        let parsed = lines.compactMap(parseLine).sorted(by: { $0.timestamp > $1.timestamp })
        if parsed != httpsTraffic {
            httpsTraffic = parsed
        }
    }

    private func parseLine(_ line: String) -> HTTPSFlow? {
        let parts = line.components(separatedBy: "|")
        guard parts.count >= 3 else { return nil }

        let host = normalize(parts[0])
        guard !host.isEmpty else { return nil }

        let request = parts.count > 1 ? parts[1] : "No request body"
        let response = parts.count > 2 ? parts[2] : "No response body"
        let timestampValue = parts.count > 3 ? (TimeInterval(parts[3]) ?? Date().timeIntervalSince1970) : Date().timeIntervalSince1970
        let encrypted = parts.count > 4 ? (parts[4].lowercased() != "false") : true

        return HTTPSFlow(
            id: "\(host)-\(timestampValue)",
            host: host,
            requestText: request,
            responseText: response,
            timestamp: Date(timeIntervalSince1970: timestampValue),
            encrypted: encrypted
        )
    }

    private func normalize(_ host: String) -> String {
        host
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .replacingOccurrences(of: "/", with: "")
    }

    private func defaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }
}