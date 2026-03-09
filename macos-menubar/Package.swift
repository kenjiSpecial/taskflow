// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "TaskFlowBar",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/soffes/HotKey", from: "0.2.1"),
    ],
    targets: [
        .executableTarget(
            name: "TaskFlowBar",
            dependencies: ["HotKey"],
            path: "TaskFlowBar"
        ),
    ]
)
