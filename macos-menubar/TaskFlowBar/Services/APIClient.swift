import Foundation

enum APIError: Error, LocalizedError {
    case invalidResponse
    case httpError(statusCode: Int)
    case noConfiguration

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid response from server"
        case .httpError(let code): return "HTTP error: \(code)"
        case .noConfiguration: return "API configuration not set"
        }
    }
}

actor APIClient {
    private let baseURL: URL
    private let token: String
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL, token: String) {
        self.baseURL = baseURL
        self.token = token
        self.session = URLSession.shared
        self.decoder = JSONDecoder()
    }

    func get<T: Decodable>(path: String, queryItems: [URLQueryItem] = []) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Todos

    func fetchTodayTodos(timezone: String = "Asia/Tokyo") async throws -> [Todo] {
        let response: TodayTodosResponse = try await get(
            path: "/api/todos/today",
            queryItems: [URLQueryItem(name: "timezone", value: timezone)]
        )
        return response.todos
    }

    func fetchInProgressTodos() async throws -> [Todo] {
        let response: TodoListResponse = try await get(
            path: "/api/todos",
            queryItems: [URLQueryItem(name: "status", value: "in_progress")]
        )
        return response.todos
    }

    // MARK: - Sessions

    func fetchActiveSessions() async throws -> [WorkSession] {
        let response: SessionListResponse = try await get(
            path: "/api/sessions",
            queryItems: [URLQueryItem(name: "status", value: "active")]
        )
        return response.sessions
    }

    // MARK: - Projects

    func fetchProjects() async throws -> [Project] {
        let response: ProjectListResponse = try await get(path: "/api/projects")
        return response.projects
    }
}
