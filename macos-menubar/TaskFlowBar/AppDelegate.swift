import AppKit
import HotKey

class AppDelegate: NSObject, NSApplicationDelegate {
    private var hotKey: HotKey?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Setup notifications
        NotificationManager.shared.setup()
        Task {
            _ = await NotificationManager.shared.requestPermission()
        }

        // Register global hotkey: Cmd+Shift+T
        hotKey = HotKey(key: .t, modifiers: [.command, .shift])
        hotKey?.keyDownHandler = { [weak self] in
            self?.togglePanel()
        }
    }

    private func togglePanel() {
        // MenuBarExtra handles its own panel; activate the app to bring it forward
        NSApp.activate(ignoringOtherApps: true)
    }
}
