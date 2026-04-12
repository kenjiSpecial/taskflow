import AppKit
import HotKey

class AppDelegate: NSObject, NSApplicationDelegate {
    private var hotKey: HotKey?
    private var waveHotKey: HotKey?

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

        // Register wave end hotkey: Cmd+Shift+W
        let waveHotKey = HotKey(key: .w, modifiers: [.command, .shift])
        waveHotKey.keyDownHandler = {
            NotificationCenter.default.post(name: .waveEndRequested, object: nil)
        }
        self.waveHotKey = waveHotKey
    }

    func applicationWillTerminate(_ notification: Notification) {
        // ServerManager のプロセスはメインスレッドで停止
        // AppState.serverManager にはここからアクセスできないため
        // NotificationCenter で通知する
        NotificationCenter.default.post(name: .appWillTerminate, object: nil)
    }
}

extension Notification.Name {
    static let appWillTerminate = Notification.Name("appWillTerminate")
    static let waveEndRequested = Notification.Name("waveEndRequested")
}
