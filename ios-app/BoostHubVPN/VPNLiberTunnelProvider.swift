import Foundation
import NetworkExtension
import OSLog

private let log = OSLog(subsystem: "com.boosthub.vpn", category: "tunnel")

final class BoostHubTunnelProvider: NEPacketTunnelProvider {

    private var pushBlocked = true
    private var unblockTimer: DispatchWorkItem?
    private var isRunning = false
    private var lastOfferId: String?
    private var pollTimer: Timer?

    private static let blockedDomains = ["push.dashapi.com", "iguazu.doordash.com"]

    override func startTunnel(
        options: [String: NSObject]?,
        completionHandler: @escaping (Error?) -> Void
    ) {
        os_log(.info, log: log, "Tunnel starting")
        reasserting = true

        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "10.8.0.1")
        settings.ipv4Settings = NEIPv4Settings(addresses: ["10.8.0.3"], subnetMasks: ["255.255.255.0"])
        settings.ipv4Settings?.includedRoutes = [NEIPv4Route.default()]
        settings.ipv4Settings?.excludedRoutes = [
            NEIPv4Route(destinationAddress: "192.168.0.0", subnetMask: "255.255.0.0"),
            NEIPv4Route(destinationAddress: "10.0.0.0", subnetMask: "255.0.0.0"),
            NEIPv4Route(destinationAddress: "172.16.0.0", subnetMask: "255.240.0.0"),
            NEIPv4Route(destinationAddress: "169.254.0.0", subnetMask: "255.255.0.0"),
        ]
        settings.dnsSettings = NEDNSSettings(servers: ["8.8.8.8", "1.1.1.1"])
        settings.dnsSettings?.matchDomains = ["dashapi.com", "doordash.com"]
        settings.mtu = 0

        setTunnelNetworkSettings(settings) { [weak self] error in
            guard let self else { return }
            if let error {
                os_log("error", log: log, "Settings: %{public}@", error.localizedDescription)
                completionHandler(error)
                return
            }
            os_log("info", log: log, "Tunnel active")
            self.isRunning = true
            self.reasserting = false
            self.readLoop()
            self.startPolling()
            completionHandler(nil)
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        os_log("info", log: log, "Stopping tunnel")
        isRunning = false
        unblockTimer?.cancel()
        pollTimer?.invalidate()
        completionHandler()
    }

    override func handleAppMessage(_ data: Data, completionHandler reply: ((Data?) -> Void)? = nil) {
        if let text = String(data: data, encoding: .utf8) {
            if text == "UNBLOCK" { unblockPush(); reply?(Data("OK".utf8)); return }
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let action = json["action"] as? String else { reply?(nil); return }
        if action == "accept" { unblockPush() }
        reply?(Data("ACK".utf8))
    }

    private func readLoop() {
        guard isRunning else { return }
        packetFlow.readPackets { [weak self] pkts, protos in
            guard let self, self.isRunning else { return }
            guard !pkts.isEmpty, pkts.count == protos.count else { self.readLoop(); return }
            var keep: [Data] = []; var protoList: [NSNumber] = []
            let block = self.pushBlocked
            for i in 0..<pkts.count {
                let p = pkts[i]; if p.isEmpty { continue }
                if block, let sni = self.sni(from: p), Self.blockedDomains.contains(where: { sni == $0 || sni.hasSuffix(".\($0)") }) {
                    continue
                }
                keep.append(p); protoList.append(protos[i])
            }
            if !keep.isEmpty { self.packetFlow.writePackets(keep, withProtocols: protoList) }
            self.readLoop()
        }
    }

    private func startPolling() {
        pollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.pollOffer()
        }
    }

    private func pollOffer() {
        guard let url = URL(string: "http://69.62.125.35:8080/offer") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            guard let self, let data, error == nil else { return }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            guard let aid = json["assignment_id"] as? String, !aid.isEmpty else { return }
            if self.lastOfferId == aid { return }
            self.lastOfferId = aid

            let offer = OfferModel(
                id: UUID().uuidString, assignmentId: aid,
                storeName: (json["store_name"] as? String) ?? "Unknown", storeAddress: (json["store_address"] as? String) ?? "",
                amount: (json["amount"] as? Double) ?? 0, tipAmount: (json["tip"] as? Double) ?? 0,
                baseAmount: (json["base_pay"] as? Double) ?? 0, distanceMiles: (json["distance_miles"] as? Double) ?? 0,
                offerExpiration: Date().addingTimeInterval(80), deadline: Date().addingTimeInterval(35),
                pickupInstructions: (json["pickup_instructions"] as? String) ?? "",
                dropoffInstructions: (json["dropoff_instructions"] as? String) ?? "",
                customerName: (json["customer_name"] as? String) ?? "",
                customerAddress: (json["customer_address"] as? String) ?? "",
                items: [], isStacked: false, referenceIdentifier: aid, capturedAt: Date(), rawPayload: nil
            )
            guard let encoded = try? JSONEncoder().encode(offer) else { return }
            UserDefaults(suiteName: "group.com.boosthub.vpn")?.set(encoded, forKey: "currentOffer")
            os_log("info", log: log, "Offer: %{public}@ $%.2f", offer.storeName, offer.amount)
        }.resume()
    }

    private func sni(from ip: Data) -> String? {
        guard ip.count >= 20 else { return nil }
        let hdr = (Int(ip[0]) & 0x0F) * 4
        guard ip.count > hdr + 20 else { return nil }
        let off = hdr + 12
        guard ip.count > off + 1 else { return nil }
        let dataOff = ((Int(ip[off]) >> 4) & 0x0F) * 4
        let tls = hdr + dataOff
        guard ip.count > tls + 5 else { return nil }
        return parseTLS(Data(ip[tls...]))
    }

    private func parseTLS(_ data: Data) -> String? {
        var p = 0
        guard data.count >= 6, data[p] == 0x16 else { return nil }
        p = 5; guard p < data.count, data[p] == 0x01 else { return nil }
        p = 43; guard p < data.count else { return nil }
        let sl = Int(data[p]); p += 1 + sl
        guard p + 2 <= data.count else { return nil }
        let cl = (Int(data[p]) << 8) | Int(data[p + 1]); p += 2 + cl
        guard p + 1 <= data.count else { return nil }
        let clen = Int(data[p]); p += 1 + clen
        guard p + 2 <= data.count else { return nil }
        let el = (Int(data[p]) << 8) | Int(data[p + 1]); p += 2
        let end = min(p + el, data.count)
        while p + 4 <= end {
            let et = (Int(data[p]) << 8) | Int(data[p + 1]); p += 2
            let es = (Int(data[p]) << 8) | Int(data[p + 1]); p += 2
            if et == 0x0000 {
                guard p + 5 <= end else { break }
                p += 2; _ = data[p]; p += 1
                let nl = (Int(data[p]) << 8) | Int(data[p + 1]); p += 2
                if nl > 0, p + nl <= data.count {
                    return String(data: Data(data[p..<(p + nl)]), encoding: .utf8)
                }
                break
            }
            p += es
        }
        return nil
    }

    private func unblockPush() {
        pushBlocked = false
        unblockTimer?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.pushBlocked = true }
        unblockTimer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0, execute: work)
    }
}
