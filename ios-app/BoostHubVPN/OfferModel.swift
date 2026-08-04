import Foundation

struct OfferModel: Codable, Identifiable, Equatable, Sendable {
    let id: String
    var assignmentId: String
    var storeName: String
    var storeAddress: String
    var amount: Double
    var tipAmount: Double
    var baseAmount: Double
    var distanceMiles: Double
    var offerExpiration: Date
    var deadline: Date
    var pickupInstructions: String
    var dropoffInstructions: String
    var customerName: String
    var customerAddress: String
    var items: [ItemInfo]
    var isStacked: Bool
    var referenceIdentifier: String
    var capturedAt: Date
    var rawPayload: String?

    var totalDisplay: String { String(format: "$%.2f", amount) }
    var tipDisplay: String { String(format: "$%.2f", tipAmount) }
    var baseDisplay: String { String(format: "$%.2f", baseAmount) }
    var distanceDisplay: String { String(format: "%.1f mi", distanceMiles) }
    var deadlineDisplay: String {
        let f = DateComponentsFormatter(); f.allowedUnits = [.minute, .second]; f.maximumUnitCount = 1; f.unitsStyle = .abbreviated
        let i = deadline.timeIntervalSinceNow; return i <= 0 ? "00:00" : f.string(from: i) ?? "0m"
    }
    var itemCountDescription: String {
        let c = items.reduce(0) { $0 + $1.quantity }; return c > 0 ? "\(c) items" : ""
    }
    var payoutBreakdown: String {
        "Base: \(baseDisplay) + Tip: \(tipDisplay)"
    }

    struct ItemInfo: Codable, Equatable, Sendable {
        let name: String
        let quantity: Int
        let price: Double
        let specialInstructions: String?

        init(name: String, quantity: Int, price: Double, specialInstructions: String?) {
            self.name = name
            self.quantity = quantity
            self.price = price
            self.specialInstructions = specialInstructions
        }
    }
}

enum OfferAction: String, Sendable {
    case accept = "accept"
    case decline = "decline"
}

struct OfferActionResponse: Codable, Equatable, Sendable {
    let success: Bool
    let message: String
    let unlockDuration: TimeInterval?
}