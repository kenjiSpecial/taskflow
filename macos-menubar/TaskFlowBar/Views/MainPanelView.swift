import SwiftUI

struct MainPanelView: View {
    @Environment(AppState.self) var appState
    @State private var showSettings = false

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
                        todoSection(
                            title: "今日のタスク",
                            icon: "calendar",
                            todos: appState.todayTodos
                        )

                        todoSection(
                            title: "進行中",
                            icon: "play.circle",
                            todos: appState.inProgressTodos
                        )

                        if !appState.activeSessions.isEmpty {
                            sessionSection
                        }
                    }
                    .padding(16)
                }
            }

            Divider()

            // Footer
            HStack {
                Button("Taskflowを開く") {
                    let webURL = appState.apiURL.contains("localhost")
                        ? "http://localhost:5173"
                        : appState.apiURL.replacingOccurrences(
                            of: "taskflow.kenji-draemon.workers.dev",
                            with: "taskflow-ui.pages.dev"
                        )
                    if let url = URL(string: webURL) {
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
        .frame(width: 350, height: 500)
        .task {
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
                    TodoRow(todo: todo)
                }
            }
        }
    }

    private var sessionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("アクティブセッション", systemImage: "timer")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            ForEach(appState.activeSessions) { session in
                SessionRow(session: session)
            }
        }
    }
}

// MARK: - Row Views

struct TodoRow: View {
    let todo: Todo

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

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "play.circle.fill")
                .foregroundStyle(.green)
                .font(.caption)

            Text(session.title)
                .font(.body)
                .lineLimit(1)

            Spacer()

            Text("\(session.taskCompleted)/\(session.taskTotal)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
