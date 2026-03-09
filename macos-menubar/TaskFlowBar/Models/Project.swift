import Foundation

struct Project: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let color: String?
    let todoCount: Int
    let sessionActiveCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, color
        case todoCount = "todo_count"
        case sessionActiveCount = "session_active_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ProjectListResponse: Codable {
    let projects: [Project]
}
