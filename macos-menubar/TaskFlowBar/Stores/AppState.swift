import Foundation
import ServiceManagement

@Observable
@MainActor
class AppState {
    var todayTodos: [Todo] = []
    var inProgressTodos: [Todo] = []
    var activeSessions: [WorkSession] = []
    var isLoading = false
    var lastError: String?
    var launchAtLogin = false
    let serverManager = ServerManager()
    let workspaceManager = WorkspaceManager()
    let waveService = WaveService()

    var appMode: AppMode {
        waveService.activeWave != nil ? .focus : .admin
    }

    // Configuration
    var apiURL: String {
        get { UserDefaults.standard.string(forKey: "apiURL") ?? "http://localhost:8787" }
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

        // Disconnect old WebSocket
        if let old = wsClient {
            Task { await old.disconnect() }
        }

        wsClient = WebSocketClient(baseURL: url, token: apiToken) { [weak self] resources in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if resources.contains("todos") || resources.contains("sessions") {
                    await self.refreshData()
                }
                if resources.contains("todos") {
                    NotificationManager.shared.sendNotification(
                        title: "TaskFlow",
                        body: "タスクが更新されました"
                    )
                }
            }
        }

        Task { await wsClient?.connect() }
        waveService.startMonitoring()
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

        workspaceManager.loadMappings()
        waveService.loadWaves()
        isLoading = false
    }

    func disconnect() {
        if let ws = wsClient {
            Task { await ws.disconnect() }
        }
        serverManager.stopFrontend()
        waveService.stopMonitoring()
    }
}
