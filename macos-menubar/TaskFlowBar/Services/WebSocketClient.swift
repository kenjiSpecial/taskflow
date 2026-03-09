import Foundation

struct RealtimeEvent: Codable, Sendable {
    let type: String
    let resources: [String]?
    let originClientId: String?
    let reason: String?
    let occurredAt: String?

    enum CodingKeys: String, CodingKey {
        case type, resources, reason
        case originClientId = "origin_client_id"
        case occurredAt = "occurred_at"
    }
}

actor WebSocketClient {
    private var task: URLSessionWebSocketTask?
    private let baseURL: URL
    private let token: String
    private let clientId: String
    private var isConnected = false
    private var reconnectAttempt = 0
    private var reconnectWork: Task<Void, Never>?
    private let onInvalidate: @Sendable ([String]) -> Void

    private static let reconnectBaseNs: UInt64 = 1_000_000_000
    private static let reconnectMaxNs: UInt64 = 10_000_000_000

    init(baseURL: URL, token: String, onInvalidate: @escaping @Sendable ([String]) -> Void) {
        self.baseURL = baseURL
        self.token = token
        self.clientId = UUID().uuidString
        self.onInvalidate = onInvalidate
    }

    func connect() {
        guard !isConnected else { return }

        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = "/api/realtime"
        components.scheme = components.scheme == "https" ? "wss" : "ws"
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "client_id", value: clientId),
        ]

        let wsTask = URLSession.shared.webSocketTask(with: components.url!)
        wsTask.resume()
        self.task = wsTask
        self.isConnected = true
        self.reconnectAttempt = 0

        Task { [weak self] in
            await self?.receiveLoop()
        }
    }

    func disconnect() {
        isConnected = false
        reconnectWork?.cancel()
        reconnectWork = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func receiveLoop() async {
        guard let task else { return }

        while isConnected {
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        handleMessage(text)
                    }
                @unknown default:
                    break
                }
            } catch {
                if isConnected {
                    self.task = nil
                    self.isConnected = false
                    scheduleReconnect()
                }
                return
            }
        }
    }

    private nonisolated func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let event = try? JSONDecoder().decode(RealtimeEvent.self, from: data) else {
            return
        }

        if event.originClientId == clientId { return }

        if event.type == "invalidate", let resources = event.resources, !resources.isEmpty {
            onInvalidate(resources)
        }
    }

    private func scheduleReconnect() {
        reconnectAttempt += 1
        let attempt = reconnectAttempt
        let delay = min(
            Self.reconnectBaseNs * UInt64(1 << (attempt - 1)),
            Self.reconnectMaxNs
        )
        let jitter = UInt64.random(in: 0...250_000_000)

        reconnectWork = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delay + jitter)
            guard !Task.isCancelled else { return }
            await self?.connect()
        }
    }
}
