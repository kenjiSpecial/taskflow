import AppKit
import HotKey

class AppDelegate: NSObject, NSApplicationDelegate {
    private var hotKey: HotKey?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Setup notifications
        Task { @MainActor in
            NotificationManager.shared.setup()
            _ = await NotificationManager.shared.requestPermission()
        }

        // Register global hotkey: Cmd+Shift+T
        hotKey = HotKey(key: .t, modifiers: [.command, .shift])
        hotKey?.keyDownHandler = {
            Task { @MainActor in
                NSApp.activate(ignoringOtherApps: true)
            }
        }
    }
}
