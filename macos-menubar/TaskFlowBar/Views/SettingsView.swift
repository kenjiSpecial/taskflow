import SwiftUI

struct SettingsInlineView: View {
    @Environment(AppState.self) var appState
    @State private var connectionStatus: String?

    var body: some View {
        @Bindable var state = appState

        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // API Settings
                VStack(alignment: .leading, spacing: 8) {
                    Label("API設定", systemImage: "network")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("API URL")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("http://localhost:8787", text: $state.apiURL)
                            .textFieldStyle(.roundedBorder)
                            .font(.body)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("APIトークン")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        SecureField("Bearer Token", text: $state.apiToken)
                            .textFieldStyle(.roundedBorder)
                            .font(.body)
                    }

                    Button("接続して保存") {
                        appState.configure()
                        Task {
                            await appState.refreshData()
                            connectionStatus = appState.lastError == nil ? "接続成功" : "接続失敗"
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)

                    if let status = connectionStatus {
                        Text(status)
                            .font(.caption)
                            .foregroundStyle(status == "接続成功" ? .green : .red)
                    }
                }

                Divider()

                // Server Settings
                VStack(alignment: .leading, spacing: 8) {
                    Label("サーバー設定", systemImage: "server.rack")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("プロジェクトルート")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("/path/to/taskflow", text: Binding(
                            get: { appState.serverManager.projectRoot },
                            set: { appState.serverManager.projectRoot = $0 }
                        ))
                            .textFieldStyle(.roundedBorder)
                            .font(.body)
                    }
                }

                Divider()

                // Wave OS Settings
                VStack(alignment: .leading, spacing: 8) {
                    Label("波乗りOS", systemImage: "water.waves")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Journalsパス")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            TextField("~/github/obsidian/journals", text: Binding(
                                get: { appState.waveService.journalsPath },
                                set: { appState.waveService.journalsPath = $0 }
                            ))
                                .textFieldStyle(.roundedBorder)
                                .font(.body)
                            Button("選択") {
                                let panel = NSOpenPanel()
                                panel.canChooseDirectories = true
                                panel.canChooseFiles = false
                                panel.allowsMultipleSelection = false
                                if panel.runModal() == .OK, let url = panel.url {
                                    appState.waveService.journalsPath = url.path
                                    appState.waveService.startMonitoring()
                                }
                            }
                        }
                    }
                }

                Divider()

                // Launch Settings
                VStack(alignment: .leading, spacing: 8) {
                    Label("起動設定", systemImage: "power")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)

                    Toggle("ログイン時に起動", isOn: Binding(
                        get: { appState.launchAtLogin },
                        set: { appState.setLaunchAtLogin($0) }
                    ))
                    .onAppear { appState.syncLoginItemStatus() }
                }

                Divider()

                // Quit
                Button("TaskFlowBarを終了") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.red)
                .font(.caption)

                if let error = appState.lastError {
                    Divider()
                    VStack(alignment: .leading, spacing: 4) {
                        Label("エラー", systemImage: "exclamationmark.triangle")
                            .font(.caption.bold())
                            .foregroundStyle(.red)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(16)
        }
    }
}
