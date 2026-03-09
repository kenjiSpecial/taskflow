import Foundation
import UserNotifications

@MainActor
class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    private var isAvailable = false

    private override init() {
        super.init()
    }

    func setup() {
        // UNUserNotificationCenter requires a bundled app
        guard Bundle.main.bundleIdentifier != nil else {
            print("[NotificationManager] Skipping setup: no bundle identifier (running via swift run?)")
            return
        }
        isAvailable = true
        UNUserNotificationCenter.current().delegate = self
    }

    func requestPermission() async -> Bool {
        guard isAvailable else { return false }
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
        } catch {
            print("Notification permission error: \(error)")
            return false
        }
    }

    nonisolated func sendNotification(title: String, body: String) {
        // Skip if not in a bundled app context
        guard Bundle.main.bundleIdentifier != nil else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                print("Notification error: \(error)")
            }
        }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .sound]
    }
}
