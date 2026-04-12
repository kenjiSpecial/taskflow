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

    private nonisolated(unsafe) var fileMonitor: DispatchSourceFileSystemObject?
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

    // MARK: - File Monitoring

    /// FSEventsでジャーナルファイルを監視開始
    func startMonitoring() {
        stopMonitoring()
        loadWaves()

        let path = todayJournalPath
        let dirPath = (path as NSString).deletingLastPathComponent

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

    // MARK: - Write Operations

    /// 波を開始する（ジャーナル末尾に追記）
    func startWave(taskName: String) {
        lastError = nil
        let path = todayJournalPath

        if activeWave != nil {
            lastError = "アクティブな波が既にあります。先に終了してください。"
            return
        }

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

    private func atomicAppend(line: String, to path: String) throws {
        var content = ""
        if FileManager.default.fileExists(atPath: path) {
            content = try String(contentsOfFile: path, encoding: .utf8)
        }

        if !content.isEmpty && !content.hasSuffix("\n") {
            content += "\n"
        }
        content += line + "\n"

        try atomicWrite(content: content, to: path)
    }

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

    private func atomicWrite(content: String, to path: String) throws {
        let dir = (path as NSString).deletingLastPathComponent
        let tmpPath = "\(dir)/.wave-tmp-\(UUID().uuidString)"

        try content.write(toFile: tmpPath, atomically: false, encoding: .utf8)

        let fm = FileManager.default
        if fm.fileExists(atPath: path) {
            _ = try fm.replaceItemAt(URL(fileURLWithPath: path),
                                     withItemAt: URL(fileURLWithPath: tmpPath))
        } else {
            try fm.moveItem(atPath: tmpPath, toPath: path)
        }
    }
}
