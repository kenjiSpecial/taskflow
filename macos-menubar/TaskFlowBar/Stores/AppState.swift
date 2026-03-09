import Foundation
import ServiceManagement

@Observable
class AppState {
    var todayTodos: [Todo] = []
    var inProgressTodos: [Todo] = []
    var activeSessions: [WorkSession] = []
    var isLoading = false
    var lastError: String?
    var launchAtLogin = false

    // Configuration
    var apiURL: String {
        get { UserDefaults.standard.string(forKey: "apiURL") ?? "https://taskflow.kenji-draemon.workers.dev" }
        set { UserDefaults.standard.set(newValue, forKey: "apiURL") }
    }

    var apiToken: String {
        get { UserDefaults.standard.string(forKey: "apiToken") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "apiToken") }
    }

    var isConfigured: Bool {
        !apiToken.isEmpty
    }

    private var apiClient: APIClient?
    private var wsClient: WebSocketClient?

    func configure() {
        guard isConfigured, let url = URL(string: apiURL) else { return }
        apiClient = APIClient(baseURL: url, token: apiToken)

        // Setup WebSocket
        wsClient?.disconnect()
        wsClient = WebSocketClient(baseURL: url, token: apiToken)
        Task {
            await wsClient?.onInvalidate = { [weak self] resources in
                guard let self else { return }
                Task { @MainActor in
                    if resources.contains("todos") {
                        await self.refreshData()
                        NotificationManager.shared.sendNotification(
                            title: "TaskFlow",
                            body: "タスクが更新されました"
                        )
                    }
                    if resources.contains("sessions") {
                        await self.refreshData()
                    }
                }
            }
            await wsClient?.connect()
        }
    }

    func syncLoginItemStatus() {
        launchAtLogin = (SMAppService.mainApp.status == .enabled)
    }

    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            launchAtLogin = enabled
        } catch {
            print("LaunchAtLogin error: \(error)")
            syncLoginItemStatus()
        }
    }

    @MainActor
    func refreshData() async {
        guard let client = apiClient else { return }
        isLoading = true
        lastError = nil

        do {
            async let todayResult = client.fetchTodayTodos()
            async let inProgressResult = client.fetchInProgressTodos()
            async let sessionsResult = client.fetchActiveSessions()

            let (today, inProgress, sessions) = try await (todayResult, inProgressResult, sessionsResult)
            self.todayTodos = today
            self.inProgressTodos = inProgress
            self.activeSessions = sessions
        } catch {
            self.lastError = error.localizedDescription
        }

        isLoading = false
    }

    func disconnect() {
        Task { await wsClient?.disconnect() }
    }
}
