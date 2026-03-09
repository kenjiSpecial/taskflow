import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) var appState

    var body: some View {
        @Bindable var state = appState

        Form {
            Section("API設定") {
                TextField("API URL", text: $state.apiURL)
                    .textFieldStyle(.roundedBorder)

                SecureField("APIトークン", text: $state.apiToken)
                    .textFieldStyle(.roundedBorder)

                Button("接続テスト") {
                    appState.configure()
                    Task { await appState.refreshData() }
                }
            }

            Section("起動設定") {
                Toggle("ログイン時に起動", isOn: Binding(
                    get: { appState.launchAtLogin },
                    set: { appState.setLaunchAtLogin($0) }
                ))
                .onAppear { appState.syncLoginItemStatus() }
            }

            if let error = appState.lastError {
                Section("エラー") {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 300)
    }
}
