import Foundation

@Observable
@MainActor
class WorkspaceManager {
    var mappings: [CmuxMapping] = []
    var operatingSessionIds: Set<String> = []
    var lastError: String?

    private static var mappingsPath: String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return "\(home)/.taskflow-cmux/mappings.json"
    }

    func hasWorkspace(sessionId: String) -> Bool {
        mappings.contains { $0.sessionId == sessionId }
    }

    func isOperating(sessionId: String) -> Bool {
        operatingSessionIds.contains(sessionId)
    }

    func loadMappings() {
        let path = Self.mappingsPath
        guard FileManager.default.fileExists(atPath: path),
              let data = FileManager.default.contents(atPath: path)
        else {
            mappings = []
            return
        }

        do {
            let decoded = try JSONDecoder().decode(CmuxMappings.self, from: data)
            mappings = decoded.mappings
        } catch {
            print("[WorkspaceManager] Failed to decode mappings: \(error)")
            mappings = []
        }
    }

    func openWorkspace(sessionId: String) async {
        operatingSessionIds.insert(sessionId)
        lastError = nil

        let success = await runCommand("taskflow-cmux start \(sessionId)")
        if success {
            loadMappings()
        } else {
            lastError = "ワークスペースの作成に失敗しました"
        }

        operatingSessionIds.remove(sessionId)
    }

    func stopSession(sessionId: String) async {
        operatingSessionIds.insert(sessionId)
        lastError = nil

        let success = await runCommand("taskflow-cmux stop \(sessionId)")
        if success {
            loadMappings()
        } else {
            lastError = "セッションの完了に失敗しました"
        }

        operatingSessionIds.remove(sessionId)
    }

    private func runCommand(_ command: String) async -> Bool {
        await withCheckedContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/zsh")
            process.arguments = ["-l", "-c", command]
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice

            do {
                try process.run()
                process.waitUntilExit()
                continuation.resume(returning: process.terminationStatus == 0)
            } catch {
                print("[WorkspaceManager] Failed to run: \(command) - \(error)")
                continuation.resume(returning: false)
            }
        }
    }
}
