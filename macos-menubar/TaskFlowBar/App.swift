import SwiftUI

@main
struct TaskFlowBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var appState = AppState()

    var body: some Scene {
        MenuBarExtra("TaskFlow", systemImage: "checklist") {
            MainPanelView()
                .environment(appState)
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
                .environment(appState)
        }
    }

    init() {
        // Configure API client on launch if token is set
        let state = AppState()
        if state.isConfigured {
            state.configure()
        }
        _appState = State(initialValue: state)
    }
}
