// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BoostHubVPN",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "BoostHubVPNKit",
            targets: ["BoostHubVPNKit"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/airbnb/lottie-ios.git", from: "4.5.0"),
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.19"),
    ],
    targets: [
        .target(
            name: "BoostHubVPNKit",
            path: "BoostHubVPN",
            sources: [
                "OfferModel.swift",
                "OfferOverlay.swift",
                "BoostHubVPNApp.swift",
                "VPNLiberTunnelProvider.swift"
            ],
            dependencies: [
                .product(name: "Lottie", package: "lottie-ios"),
                "ZIPFoundation",
            ]
        )
    ]
)