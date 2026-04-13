# TaskFlowBar 波乗りOS統合 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TaskFlowBarにWaveService（journals/パース + FSEvents監視 + 波の開始/終了）を統合し、Focus/Adminモード切替とメニューバーアイコン動的変化を実装する。

**Architecture:** WaveServiceがローカルのMarkdownジャーナルファイルを読み書きし、AppStateがWaveServiceとAPIClientの両方を集約する。波がアクティブなときはUIがFocusモードに切り替わり、メニューバーアイコンが`water.waves`に変化する。

**Tech Stack:** Swift 6.1, SwiftUI, macOS 14+, FSEvents (DispatchSource.makeFileSystemObjectSource), soffes/HotKey

**Design Doc:** `~/.gstack/projects/playground/kenjisaito-unknown-design-20260412-211045.md`

**Journals Path:** `~/github/obsidian/journals/` (SettingsViewで変更可能。デザイン仕様のデフォルト `~/journals/` からユーザーの実環境に合わせて変更済み)

---

## File Structure

### 新規ファイル
| File | Responsibility |
|------|---------------|
| `TaskFlowBar/Models/Wave.swift` | 波のデータモデル（Wave struct, WaveStatus enum） |
| `TaskFlowBar/Services/WaveService.swift` | journals/パース、FSEvents監視、波の開始/終了書き込み |
| `TaskFlowBar/Views/WaveSection.swift` | 波の表示UI（Focus mode用の大きな残り時間表示） |
| `TaskFlowBar/Views/WaveStartSheet.swift` | 波開始の確認ポップオーバー |

### 変更ファイル
| File | Changes |
|------|---------|
| `TaskFlowBar/Stores/AppState.swift` | WaveService統合、appMode (focus/admin)、波関連のpublished state |
| `TaskFlowBar/Views/MainPanelView.swift` | Focus/Adminモード切替、波セクション追加、TodoRowに🌊ボタン |
| `TaskFlowBar/Views/SettingsView.swift` | journals/パス設定フィールド追加 |
| `TaskFlowBar/App.swift` | メニューバーアイコン動的切替（checklist ↔ water.waves） |
| `TaskFlowBar/AppDelegate.swift` | 波開始/終了ホットキー追加 |

---

## Task 1: Wave Model

**Files:**
- Create: `macos-menubar/TaskFlowBar/Models/Wave.swift`

- [ ] **Step 1: Create Wave.swift with data model**

```swift
import Foundation

struct Wave: Identifiable, Sendable {
    let id = UUID()
    let number: Int
    let startTime: String      // "HH:MM"
    let endTime: String?       // nil = active
    let taskName: String
    let score: Int?            // 1-5, nil = active

    var isActive: Bool { endTime == nil }

    /// 開始時刻からDateを生成（今日の日付で）
    var startDate: Date? {
        Self.timeToDate(startTime)
    }

    var endDate: Date? {
        guard let end = endTime else { return nil }
        return Self.timeToDate(end)
    }

    /// 経過時間（分）
    var elapsedMinutes: Int? {
        guard let start = startDate else { return nil }
        let end = endDate ?? Date()
        return max(0, Int(end.timeIntervalSince(start) / 60))
    }

    /// 90分波の残り時間（分）
    var remainingMinutes: Int? {
        guard let elapsed = elapsedMinutes else { return nil }
        return max(0, 90 - elapsed)
    }

    /// 所要時間からスコアを計算
    static func calculateScore(minutes: Int) -> Int {
        switch minutes {
        case 0..<20: return 1
        case 20..<40: return 2
        case 40..<60: return 3
        case 60..<80: return 4
        default: return 5
        }
    }

    private static func timeToDate(_ time: String) -> Date? {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return nil }
        let cal = Calendar.current
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: Date())
    }
}

enum AppMode {
    case focus  // 波アクティブ
    case admin  // 波なし
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Models/Wave.swift && git commit -m "feat(menubar): 波のデータモデルを追加"
```

---

## Task 2: WaveService — パーサー

**Files:**
- Create: `macos-menubar/TaskFlowBar/Services/WaveService.swift`

- [ ] **Step 1: WaveService基本構造とパーサーを作成**

```swift
import Foundation

@Observable
@MainActor
class WaveService {
    var waves: [Wave] = []
    var activeWave: Wave? { waves.first(where: { $0.isActive }) }
    var todayScore: [Wave] { waves.filter { !$0.isActive } }
    var lastError: String?

    var journalsPath: String {
        get { UserDefaults.standard.string(forKey: "journalsPath")
              ?? "\(FileManager.default.homeDirectoryForCurrentUser.path)/github/obsidian/journals" }
        set { UserDefaults.standard.set(newValue, forKey: "journalsPath") }
    }

    private var fileMonitor: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1

    /// 今日の日付文字列 (YYYY-MM-DD)
    private var todayString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    /// 今日のジャーナルファイルパス
    var todayJournalPath: String {
        "\(journalsPath)/\(todayString).md"
    }

    // MARK: - Parse

    /// ジャーナルファイルを読んで🌊行をパースする
    func loadWaves() {
        let path = todayJournalPath
        guard FileManager.default.fileExists(atPath: path) else {
            waves = []
            return
        }

        do {
            let content = try String(contentsOfFile: path, encoding: .utf8)
            waves = parseWaves(from: content)
        } catch {
            waves = []
            lastError = "ジャーナル読み込み失敗: \(error.localizedDescription)"
        }
    }

    /// Markdown文字列から波をパースする
    func parseWaves(from content: String) -> [Wave] {
        // パターン: - 🌊 波{N} {HH:MM}-{HH:MM?} {タスク名} (スコア:{S})? #wave
        let pattern = #"^- 🌊 波(\d+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})?\s+(.+?)(?:\s+スコア:(\d+))?\s+#wave\s*$"#

        var result: [Wave] = []

        for line in content.components(separatedBy: "\n") {
            guard let match = try? NSRegularExpression(pattern: pattern)
                .firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) else {
                continue
            }

            guard let numberRange = Range(match.range(at: 1), in: line),
                  let startRange = Range(match.range(at: 2), in: line),
                  let taskRange = Range(match.range(at: 4), in: line) else {
                continue
            }

            let number = Int(line[numberRange]) ?? 0
            let startTime = String(line[startRange])
            let taskName = String(line[taskRange])

            var endTime: String?
            if match.range(at: 3).location != NSNotFound,
               let endRange = Range(match.range(at: 3), in: line) {
                endTime = String(line[endRange])
            }

            var score: Int?
            if match.range(at: 5).location != NSNotFound,
               let scoreRange = Range(match.range(at: 5), in: line) {
                score = Int(line[scoreRange])
            }

            result.append(Wave(
                number: number,
                startTime: startTime,
                endTime: endTime,
                taskName: taskName,
                score: score
            ))
        }

        return result
    }
}
```

- [ ] **Step 2: パーサーの動作確認（swift build）**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Services/WaveService.swift && git commit -m "feat(menubar): WaveService パーサーを実装"
```

---

## Task 3: WaveService — FSEvents ファイル監視

**Files:**
- Modify: `macos-menubar/TaskFlowBar/Services/WaveService.swift`

- [ ] **Step 1: ファイル監視メソッドを追加**

WaveServiceに以下を追加:

```swift
    // MARK: - File Monitoring

    /// FSEventsでジャーナルファイルを監視開始
    func startMonitoring() {
        stopMonitoring()
        loadWaves()

        let path = todayJournalPath
        let dirPath = (path as NSString).deletingLastPathComponent

        // ディレクトリが存在しない場合はスキップ
        guard FileManager.default.fileExists(atPath: dirPath) else { return }

        fileDescriptor = open(dirPath, O_EVTONLY)
        guard fileDescriptor >= 0 else { return }

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fileDescriptor,
            eventMask: [.write, .rename],
            queue: .main
        )

        source.setEventHandler { [weak self] in
            Task { @MainActor in
                self?.loadWaves()
            }
        }

        source.setCancelHandler { [weak self] in
            guard let self else { return }
            if self.fileDescriptor >= 0 {
                close(self.fileDescriptor)
                self.fileDescriptor = -1
            }
        }

        source.resume()
        fileMonitor = source
    }

    /// 監視停止
    func stopMonitoring() {
        fileMonitor?.cancel()
        fileMonitor = nil
    }

    deinit {
        // Swift 6: deinit runs outside actor context.
        // close() is handled by setCancelHandler, so just cancel here.
        fileMonitor?.cancel()
    }
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Services/WaveService.swift && git commit -m "feat(menubar): WaveService FSEventsファイル監視を追加"
```

---

## Task 4: WaveService — 波の開始/終了（atomic write）

**Files:**
- Modify: `macos-menubar/TaskFlowBar/Services/WaveService.swift`

- [ ] **Step 1: 波の開始・終了の書き込みメソッドを追加**

WaveServiceに以下を追加:

```swift
    // MARK: - Write Operations

    /// 波を開始する（ジャーナル末尾に追記）
    func startWave(taskName: String) {
        lastError = nil
        let path = todayJournalPath

        // 既にアクティブな波がある場合はエラー
        if activeWave != nil {
            lastError = "アクティブな波が既にあります。先に終了してください。"
            return
        }

        // 波番号: 既存の🌊行数 + 1
        let nextNumber = waves.count + 1

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let now = formatter.string(from: Date())

        let line = "- 🌊 波\(nextNumber) \(now)- \(taskName) #wave"

        do {
            try atomicAppend(line: line, to: path)
            loadWaves()
        } catch {
            lastError = "波の開始に失敗: \(error.localizedDescription)"
        }
    }

    /// アクティブな波を終了する（該当行を更新）
    func endWave() {
        lastError = nil
        let path = todayJournalPath

        guard let active = activeWave else {
            lastError = "アクティブな波がありません。"
            return
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let now = formatter.string(from: Date())

        let minutes = active.elapsedMinutes ?? 0
        let score = Wave.calculateScore(minutes: minutes)

        // 元の行を検索して置換
        let searchPattern = "- 🌊 波\(active.number) \(active.startTime)- \(active.taskName) #wave"
        let replacement = "- 🌊 波\(active.number) \(active.startTime)-\(now) \(active.taskName) スコア:\(score) #wave"

        do {
            try atomicReplace(in: path, search: searchPattern, replacement: replacement)
            loadWaves()
        } catch {
            lastError = "波の終了に失敗: \(error.localizedDescription)"
        }
    }

    // MARK: - Atomic File Operations

    /// ファイル末尾に行を追記（atomic write）
    private func atomicAppend(line: String, to path: String) throws {
        var content = ""
        if FileManager.default.fileExists(atPath: path) {
            content = try String(contentsOfFile: path, encoding: .utf8)
        }

        // 末尾に改行がなければ追加
        if !content.isEmpty && !content.hasSuffix("\n") {
            content += "\n"
        }
        content += line + "\n"

        try atomicWrite(content: content, to: path)
    }

    /// ファイル内の文字列を置換（atomic write）
    private func atomicReplace(in path: String, search: String, replacement: String) throws {
        guard FileManager.default.fileExists(atPath: path) else {
            throw NSError(domain: "WaveService", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "ファイルが見つかりません"])
        }

        var content = try String(contentsOfFile: path, encoding: .utf8)
        guard content.contains(search) else {
            throw NSError(domain: "WaveService", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "対象の波が見つかりません"])
        }

        content = content.replacingOccurrences(of: search, with: replacement)
        try atomicWrite(content: content, to: path)
    }

    /// 一時ファイルに書いてrenameする（atomic write）
    private func atomicWrite(content: String, to path: String) throws {
        let dir = (path as NSString).deletingLastPathComponent
        let tmpPath = "\(dir)/.wave-tmp-\(UUID().uuidString)"

        try content.write(toFile: tmpPath, atomically: false, encoding: .utf8)

        // rename (atomic on same filesystem)
        let fm = FileManager.default
        if fm.fileExists(atPath: path) {
            _ = try fm.replaceItemAt(URL(fileURLWithPath: path),
                                     withItemAt: URL(fileURLWithPath: tmpPath))
        } else {
            try fm.moveItem(atPath: tmpPath, toPath: path)
        }
    }
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Services/WaveService.swift && git commit -m "feat(menubar): WaveService 波の開始/終了をatomic writeで実装"
```

---

## Task 5: AppState統合 + SettingsView

**Files:**
- Modify: `macos-menubar/TaskFlowBar/Stores/AppState.swift`
- Modify: `macos-menubar/TaskFlowBar/Views/SettingsView.swift`

- [ ] **Step 1: AppStateにWaveServiceとモードを追加**

`AppState.swift` に以下を追加:

プロパティ追加（既存プロパティの後に）:
```swift
    let waveService = WaveService()

    var appMode: AppMode {
        waveService.activeWave != nil ? .focus : .admin
    }
```

`configure()` メソッドの末尾に追加:
```swift
        waveService.startMonitoring()
```

`refreshData()` の末尾（`isLoading = false` の前）に追加:
```swift
        waveService.loadWaves()
```

`disconnect()` の末尾に追加:
```swift
        waveService.stopMonitoring()
```

- [ ] **Step 2: SettingsViewにjournalsパス設定を追加**

`SettingsView.swift` の `SettingsInlineView` 内、APIセクションの後に追加:

```swift
            // Wave OS Settings
            VStack(alignment: .leading, spacing: 8) {
                Text("波乗りOS")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)

                HStack {
                    TextField("Journalsパス", text: Binding(
                        get: { appState.waveService.journalsPath },
                        set: { appState.waveService.journalsPath = $0 }
                    ))
                        .textFieldStyle(.roundedBorder)
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
            .padding(.bottom, 8)
```

注: `journalsPath` はUserDefaults-backed computed propertyのため `@Bindable` では動作しない。既存のSettingsView.swiftと同じ `Binding(get:set:)` パターンを使用する。

- [ ] **Step 3: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 4: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Stores/AppState.swift macos-menubar/TaskFlowBar/Views/SettingsView.swift && git commit -m "feat(menubar): AppStateにWaveService統合、設定にjournalsパスを追加"
```

---

## Task 6: WaveSection UI

**Files:**
- Create: `macos-menubar/TaskFlowBar/Views/WaveSection.swift`

- [ ] **Step 1: 波の表示コンポーネントを作成**

```swift
import SwiftUI

struct WaveSection: View {
    let wave: Wave?
    let todayWaves: [Wave]
    let onEnd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let wave {
                // アクティブな波
                activeWaveView(wave)
            } else if !todayWaves.isEmpty {
                // 今日の波サマリー
                waveSummary
            }
        }
    }

    // MARK: - Active Wave

    private func activeWaveView(_ wave: Wave) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("波\(wave.number)", systemImage: "water.waves")
                    .font(.subheadline.bold())
                    .foregroundStyle(.blue)
                Spacer()
                Button {
                    onEnd()
                } label: {
                    Text("終了")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
            }

            Text(wave.taskName)
                .font(.body)
                .lineLimit(2)

            HStack(spacing: 16) {
                // 経過時間
                if let elapsed = wave.elapsedMinutes {
                    Label("\(elapsed)分経過", systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // 残り時間
                if let remaining = wave.remainingMinutes {
                    Label {
                        Text(remaining > 0 ? "残り\(remaining)分" : "延長中")
                    } icon: {
                        Image(systemName: remaining > 0 ? "timer" : "exclamationmark.circle")
                    }
                    .font(.caption)
                    .foregroundStyle(remaining > 10 ? .secondary : .orange)
                }
            }

            // プログレスバー
            if let elapsed = wave.elapsedMinutes {
                let progress = min(1.0, Double(elapsed) / 90.0)
                ProgressView(value: progress)
                    .tint(progress >= 1.0 ? .orange : .blue)
            }
        }
        .padding(12)
        .background(.blue.opacity(0.05))
        .cornerRadius(8)
    }

    // MARK: - Summary

    private var waveSummary: some View {
        HStack {
            Label("今日の波: \(todayWaves.count)", systemImage: "water.waves")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            let avgScore = todayWaves.compactMap(\.score).reduce(0, +)
            let count = todayWaves.compactMap(\.score).count
            if count > 0 {
                Text("平均スコア: \(avgScore / count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Views/WaveSection.swift && git commit -m "feat(menubar): WaveSection UIコンポーネントを作成"
```

---

## Task 7: WaveStartSheet

**Files:**
- Create: `macos-menubar/TaskFlowBar/Views/WaveStartSheet.swift`

- [ ] **Step 1: 波開始確認ポップオーバーを作成**

```swift
import SwiftUI

struct WaveStartSheet: View {
    @Environment(AppState.self) var appState
    @Binding var isPresented: Bool
    @State private var taskName: String
    let initialTaskName: String

    init(isPresented: Binding<Bool>, taskName: String) {
        _isPresented = isPresented
        _taskName = State(initialValue: taskName)
        initialTaskName = taskName
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("波を開始")
                .font(.headline)

            TextField("タスク名", text: $taskName)
                .textFieldStyle(.roundedBorder)

            HStack {
                Button("キャンセル") {
                    isPresented = false
                }
                .keyboardShortcut(.escape)

                Spacer()

                Button("開始") {
                    appState.waveService.startWave(taskName: taskName)
                    isPresented = false
                }
                .keyboardShortcut(.return)
                .disabled(taskName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(16)
        .frame(width: 280)
    }
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Views/WaveStartSheet.swift && git commit -m "feat(menubar): WaveStartSheet 確認ポップオーバーを作成"
```

---

## Task 8: MainPanelView — Focus/Admin モード切替

**Files:**
- Modify: `macos-menubar/TaskFlowBar/Views/MainPanelView.swift`

- [ ] **Step 1: MainPanelViewに波セクションとモード切替を統合**

`MainPanelView.swift` を変更する。

**1) State追加:**
```swift
    @State private var showWaveStart = false
    @State private var waveStartTaskName = ""
```

**2) ScrollView内の VStack を変更 — 波セクションを条件付きでトップに:**

`MainPanelView.swift` の `body` 内、`} else if !appState.isConfigured { unconfiguredView } else {` の else ブランチにある既存の ScrollView ブロック（3つのセクション: セッション、今日のタスク、進行中）を以下に置換:

```swift
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // 波セクション（常に最上部）
                        WaveSection(
                            wave: appState.waveService.activeWave,
                            todayWaves: appState.waveService.todayScore,
                            onEnd: {
                                appState.waveService.endWave()
                            }
                        )

                        // 波がアクティブでないとき: フルUI表示
                        if appState.appMode == .admin {
                            // セッション
                            if !appState.activeSessions.isEmpty {
                                sessionsSection
                            }
                        }

                        // 今日のタスク（常に表示）
                        todoSection(
                            title: "今日のタスク",
                            icon: "calendar",
                            todos: appState.todayTodos
                        )

                        // 進行中（常に表示）
                        todoSection(
                            title: "進行中",
                            icon: "play.circle",
                            todos: appState.inProgressTodos
                        )
                    }
                    .padding(16)
                }
```

**3) TodoRowに🌊ボタンを追加:**

既存の `TodoRow` structを変更。`body` の `HStack` 末尾、`dueDate` 表示の後に追加:

```swift
            // 波開始ボタン（アクティブ波がないときのみ）
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
```

TodoRowにclosure追加（既存の `let todo: Todo` の後に）:
```swift
    var onWaveStart: (() -> Void)? = nil
```

これにより memberwise init に `onWaveStart` がデフォルト `nil` で追加され、既存の `TodoRow(todo: todo)` 呼び出しはそのまま動作する。

**4) todoSectionの `ForEach` を変更して onWaveStart を渡す:**

```swift
                ForEach(todos) { todo in
                    TodoRow(todo: todo, onWaveStart: appState.waveService.activeWave == nil ? {
                        waveStartTaskName = todo.title
                        showWaveStart = true
                    } : nil)
                }
```

**5) `.popover` を `.frame(...)` の前に追加:**

```swift
        .popover(isPresented: $showWaveStart) {
            WaveStartSheet(isPresented: $showWaveStart, taskName: waveStartTaskName)
                .environment(appState)
        }
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: 実行して動作確認**

Run: `cd ~/github/taskflow/macos-menubar && swift run`

確認ポイント:
- メニューバーアイコンをクリックしてパネルが開く
- 波セクションが最上部に表示される（波がない場合はサマリーまたは非表示）
- TodoRowに🌊ボタンが表示される
- 🌊ボタンをクリックするとWaveStartSheetが表示される
- タスク名がプリセットされている
- 「開始」で波が始まり、journals/に書き込まれる
- 波アクティブ時はセッションセクションが非表示になる（Focus mode）

- [ ] **Step 4: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Views/MainPanelView.swift && git commit -m "feat(menubar): Focus/Adminモード切替、TodoRowに波開始ボタンを追加"
```

---

## Task 9: メニューバーアイコン動的変化

**Files:**
- Modify: `macos-menubar/TaskFlowBar/App.swift`

- [ ] **Step 1: App.swiftのMenuBarExtraアイコンを動的に変更**

`App.swift` の `body` を変更。`MenuBarExtra` を以下に置換:

```swift
    var body: some Scene {
        MenuBarExtra("TaskFlow",
                     systemImage: appState.waveService.activeWave != nil ? "water.waves" : "checklist") {
            MainPanelView()
                .environment(appState)
        }
        .menuBarExtraStyle(.window)
    }
```

注: macOS 14+の`MenuBarExtra`は`systemImage`の動的変更に反応しないケースが報告されている。反応しない場合のフォールバック:

```swift
// App.swift — フォールバック: AppDelegateからNSStatusItemを直接制御
// 1. AppDelegateにstatusItem参照を追加
// 2. WaveServiceの変更をNotificationCenterで通知
// 3. AppDelegate側でstatusItem.button?.image を切り替え

// AppDelegate.swift に追加:
func updateMenuBarIcon(isWaveActive: Bool) {
    guard let button = NSApp.windows.first(where: {
        $0.className.contains("NSStatusBar")
    }) else { return }
    // NSStatusItem.button?.image を直接設定
}
```

まず `systemImage` の直接切り替えを試し、動作しなければ AppDelegate 経由に切り替える。

- [ ] **Step 2: ビルド・実行確認**

Run: `cd ~/github/taskflow/macos-menubar && swift run`

確認ポイント:
- 波がないとき: `checklist` アイコン
- 波を開始すると: `water.waves` アイコンに変化
- 波を終了すると: `checklist` に戻る

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/App.swift && git commit -m "feat(menubar): 波アクティブ時にメニューバーアイコンをwater.wavesに変更"
```

---

## Task 10: ホットキー追加

**Files:**
- Modify: `macos-menubar/TaskFlowBar/AppDelegate.swift`

- [ ] **Step 1: 波終了のホットキーを追加**

`AppDelegate.swift` に波終了用ホットキーを追加。`applicationDidFinishLaunching` 内:

```swift
        // Register wave end hotkey: Cmd+Shift+W
        let waveHotKey = HotKey(key: .w, modifiers: [.command, .shift])
        waveHotKey.keyDownHandler = {
            // Wave end は NotificationCenter 経由で AppState に伝える
            NotificationCenter.default.post(name: .waveEndRequested, object: nil)
        }
        self.waveHotKey = waveHotKey
```

プロパティ追加:
```swift
    private var waveHotKey: HotKey?
```

Notification.Name拡張に追加:
```swift
    static let waveEndRequested = Notification.Name("waveEndRequested")
```

そしてAppStateの `configure()` 末尾でリスナー登録:

```swift
        NotificationCenter.default.addObserver(forName: .waveEndRequested, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.waveService.endWave()
            }
        }
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/AppDelegate.swift macos-menubar/TaskFlowBar/Stores/AppState.swift && git commit -m "feat(menubar): Cmd+Shift+Wで波終了のホットキーを追加"
```

---

## Task 11: 波終了通知

**Files:**
- Modify: `macos-menubar/TaskFlowBar/Services/WaveService.swift`

- [ ] **Step 1: 波終了時にシステム通知を送信**

WaveServiceの `endWave()` メソッド末尾、`loadWaves()` の後に追加:

```swift
            // 終了通知
            NotificationManager.shared.sendNotification(
                title: "🌊 波\(active.number) 終了",
                body: "\(active.taskName) — スコア:\(score) (\(minutes)分)"
            )
```

- [ ] **Step 2: ビルド確認**

Run: `cd ~/github/taskflow/macos-menubar && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
cd ~/github/taskflow && git add macos-menubar/TaskFlowBar/Services/WaveService.swift && git commit -m "feat(menubar): 波終了時にシステム通知を送信"
```

---

## Task 12: 統合テスト・最終確認

**Files:** (全ファイル)

- [ ] **Step 1: フルビルド**

Run: `cd ~/github/taskflow/macos-menubar && swift build -c release 2>&1 | tail -10`
Expected: `Build complete!`

- [ ] **Step 2: アプリ起動して全機能テスト**

Run: `cd ~/github/taskflow/macos-menubar && swift run`

テストチェックリスト:
1. メニューバーにchecklistアイコンが表示される
2. パネルを開くと波セクション（サマリーまたは空）が見える
3. 設定でjournalsパスが正しい（`~/github/obsidian/journals/`）
4. TodoRowの🌊ボタンをクリック → WaveStartSheet表示
5. タスク名を確認して「開始」→ journals/今日.md に🌊行が追記される
6. メニューバーアイコンが`water.waves`に変化
7. パネルがFocusモードになる（セッションセクション非表示）
8. 経過時間・残り時間・プログレスバーが表示される
9. 「終了」ボタンまたは Cmd+Shift+W で波が終了する
10. journals/の🌊行に終了時刻とスコアが追記される
11. メニューバーアイコンが`checklist`に戻る
12. システム通知が表示される
13. Obsidianで同じファイルを開いても競合しない

- [ ] **Step 3: 最終コミット（必要な場合のみ）**

テストで修正が必要だった場合のみ:
```bash
cd ~/github/taskflow && git add -A macos-menubar/ && git commit -m "fix(menubar): 波乗りOS統合の最終調整"
```

- [ ] **Step 4: mainにpush**

```bash
cd ~/github/taskflow && git push origin main
```
