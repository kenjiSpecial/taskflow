import Foundation

@Observable
@MainActor
class ServerManager {
    var isFrontendRunning = false
    var isStarting = false

    private var frontendProcess: Process?

    var projectRoot: String {
        get { UserDefaults.standard.string(forKey: "projectRoot") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "projectRoot") }
    }

    var canStart: Bool {
        !projectRoot.isEmpty && !isStarting && !isFrontendRunning
    }

    /// localhost:5173 にリクエストしてフロントエンド生存確認
    func checkFrontend() async {
        guard let url = URL(string: "http://localhost:5173") else {
            isFrontendRunning = false
            return
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 2
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            isFrontendRunning = (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            isFrontendRunning = false
        }
    }

    /// cd frontend && npm run dev でフロントエンドを起動
    func startFrontend() async {
        guard canStart else { return }
        isStarting = true

        let dir = "\(projectRoot)/frontend"
        frontendProcess = launchProcess(command: "npm run dev", directory: dir)

        // フロントエンド起動を待つ（最大10秒）
        for _ in 0..<20 {
            try? await Task.sleep(for: .milliseconds(500))
            await checkFrontend()
            if isFrontendRunning { break }
        }

        isStarting = false
    }

    func stopFrontend() {
        frontendProcess?.terminate()
        frontendProcess = nil
        isFrontendRunning = false
    }

    private func launchProcess(command: String, directory: String) -> Process? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-l", "-c", command]
        process.currentDirectoryURL = URL(fileURLWithPath: directory)
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            return process
        } catch {
            print("[ServerManager] Failed to launch: \(command) - \(error)")
            return nil
        }
    }
}
