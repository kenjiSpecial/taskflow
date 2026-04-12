import SwiftUI

struct MainPanelView: View {
    @Environment(AppState.self) var appState
    @State private var showSettings = false
    @State private var showWaveStart = false
    @State private var waveStartTaskName = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                if showSettings {
                    Button {
                        showSettings = false
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .buttonStyle(.borderless)
                }

                Text(showSettings ? "設定" : "TaskFlow")
                    .font(.headline)
                Spacer()

                if !showSettings {
                    if appState.isLoading {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Button {
                        Task { await appState.refreshData() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            if showSettings {
                SettingsInlineView()
            } else if !appState.isConfigured {
                unconfiguredView
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Wave section (always on top)
                        WaveSection(
                            wave: appState.waveService.activeWave,
                            todayWaves: appState.waveService.todayScore,
                            onEnd: {
                                appState.waveService.endWave()
                            }
                        )

                        // Sessions only in admin mode
                        if appState.appMode == .admin {
                            if !appState.activeSessions.isEmpty {
                                sessionsSection
                            }
                        }

                        // Today tasks (always visible)
                        todoSection(
                            title: "今日のタスク",
                            icon: "calendar",
                            todos: appState.todayTodos
                        )

                        // In progress (always visible)
                        todoSection(
                            title: "進行中",
                            icon: "play.circle",
                            todos: appState.inProgressTodos
                        )
                    }
                    .padding(16)
                }
            }

            Divider()

            // Footer
            HStack {
                if appState.serverManager.isFrontendRunning {
                    Button("Taskflowを開く") {
                        if let url = URL(string: "http://localhost:5173") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.borderless)
                } else if appState.serverManager.isStarting {
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.mini)
                        Text("起動中…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else if appState.serverManager.canStart {
                    Button {
                        Task { await appState.serverManager.startFrontend() }
                    } label: {
                        Label("フロントエンドを起動", systemImage: "play.fill")
                    }
                    .buttonStyle(.borderless)
                } else {
                    Button("Taskflowを開く") {
                        if let url = URL(string: "http://localhost:5173") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.borderless)
                }

                Button("波乗りOS") {
                    if let url = URL(string: "http://localhost:3000") {
                        NSWorkspace.shared.open(url)
                    }
                }
                .buttonStyle(.borderless)

                Spacer()

                Button {
                    showSettings.toggle()
                } label: {
                    Image(systemName: "gear")
                }
                .buttonStyle(.borderless)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .popover(isPresented: $showWaveStart) {
            WaveStartSheet(isPresented: $showWaveStart, taskName: waveStartTaskName)
                .environment(appState)
        }
        .frame(width: 350, height: 500)
        .task {
            await appState.serverManager.checkFrontend()
            if appState.isConfigured {
                await appState.refreshData()
            }
        }
    }

    // MARK: - Subviews

    private var unconfiguredView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "gear.badge.questionmark")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("APIトークンを設定してください")
                .foregroundStyle(.secondary)
            Button("設定を開く") {
                showSettings = true
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Sessions (grouped by project)

    private var sessionsSection: some View {
        let grouped = groupedSessions
        return VStack(alignment: .leading, spacing: 12) {
            ForEach(grouped, id: \.projectName) { group in
                ProjectSessionGroup(
                    projectName: group.projectName,
                    sessions: group.sessions,
                    workspaceManager: appState.workspaceManager,
                    onStop: { sessionId in
                        Task {
                            await appState.workspaceManager.stopSession(sessionId: sessionId)
                            await appState.refreshData()
                        }
                    }
                )
            }
        }
    }

    private var groupedSessions: [SessionGroup] {
        let wm = appState.workspaceManager
        var groups: [String: [WorkSession]] = [:]

        for session in appState.activeSessions {
            let key = session.project ?? "その他"
            groups[key, default: []].append(session)
        }

        return groups.map { name, sessions in
            // WS開いているセッションを上にソート
            let sorted = sessions.sorted { a, b in
                let aHasWS = wm.hasWorkspace(sessionId: a.id)
                let bHasWS = wm.hasWorkspace(sessionId: b.id)
                if aHasWS != bHasWS { return aHasWS }
                return a.createdAt > b.createdAt
            }
            return SessionGroup(projectName: name, sessions: sorted)
        }
        .sorted { a, b in
            // 「その他」を末尾に
            if a.projectName == "その他" { return false }
            if b.projectName == "その他" { return true }
            return a.projectName < b.projectName
        }
    }

    // MARK: - Todos

    private func todoSection(title: String, icon: String, todos: [Todo]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            if todos.isEmpty {
                Text("なし")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 4)
            } else {
                ForEach(todos) { todo in
                    TodoRow(todo: todo, onWaveStart: appState.waveService.activeWave == nil ? {
                        waveStartTaskName = todo.title
                        showWaveStart = true
                    } : nil)
                }
            }
        }
    }
}

// MARK: - Data Types

private struct SessionGroup {
    let projectName: String
    let sessions: [WorkSession]
}

// MARK: - Project Session Group

struct ProjectSessionGroup: View {
    let projectName: String
    let sessions: [WorkSession]
    let workspaceManager: WorkspaceManager
    let onStop: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Project header
            HStack(spacing: 6) {
                Circle()
                    .fill(.blue)
                    .frame(width: 8, height: 8)
                Text(projectName)
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
            }

            // Session rows
            ForEach(sessions) { session in
                SessionRow(
                    session: session,
                    workspaceManager: workspaceManager,
                    onStop: onStop
                )
            }
        }
    }
}

// MARK: - Row Views

struct TodoRow: View {
    let todo: Todo
    var onWaveStart: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)

            Text(todo.title)
                .font(.body)
                .lineLimit(1)

            Spacer()

            if let dueDate = todo.dueDate {
                Text(formatDate(dueDate))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if onWaveStart != nil {
                Button {
                    onWaveStart?()
                } label: {
                    Image(systemName: "water.waves")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }
                .buttonStyle(.borderless)
                .help("この名前で波を開始")
            }
        }
        .padding(.vertical, 2)
    }

    private var priorityColor: Color {
        switch todo.priority {
        case "high": return .red
        case "medium": return .orange
        default: return .gray
        }
    }

    private func formatDate(_ dateString: String) -> String {
        let parts = dateString.prefix(10).split(separator: "-")
        guard parts.count >= 3 else { return dateString }
        return "\(parts[1])/\(parts[2])"
    }
}

struct SessionRow: View {
    let session: WorkSession
    let workspaceManager: WorkspaceManager
    let onStop: (String) -> Void

    private var hasWorkspace: Bool {
        workspaceManager.hasWorkspace(sessionId: session.id)
    }

    private var isOperating: Bool {
        workspaceManager.isOperating(sessionId: session.id)
    }

    var body: some View {
        HStack(spacing: 8) {
            // WS状態アイコン
            Image(systemName: hasWorkspace ? "terminal.fill" : "terminal")
                .foregroundStyle(hasWorkspace ? .green : .secondary)
                .font(.caption)

            // タイトル
            Text(session.title)
                .font(.body)
                .lineLimit(1)

            Spacer()

            // タスク進捗
            Text("\(session.taskCompleted)/\(session.taskTotal)")
                .font(.caption2)
                .foregroundStyle(.secondary)

            if isOperating {
                ProgressView()
                    .controlSize(.mini)
            } else {
                // 開く/作成ボタン
                Button {
                    Task {
                        await workspaceManager.openWorkspace(sessionId: session.id)
                    }
                } label: {
                    Image(systemName: hasWorkspace ? "arrow.right.circle" : "plus.circle")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .help(hasWorkspace ? "ワークスペースを開く" : "ワークスペースを作成")

                // 完了ボタン
                Button {
                    onStop(session.id)
                } label: {
                    Image(systemName: "xmark.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.borderless)
                .help("セッションを完了")
            }
        }
        .padding(.vertical, 2)
        .padding(.leading, 14)
    }
}
