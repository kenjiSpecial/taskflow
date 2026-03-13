import Foundation

struct WorkSession: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: String  // active | paused | done
    let projectId: String?
    let project: String?
    let taskTotal: Int
    let taskCompleted: Int
    let deletedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, project
        case projectId = "project_id"
        case taskTotal = "task_total"
        case taskCompleted = "task_completed"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isActive: Bool { status == "active" }
    var isPaused: Bool { status == "paused" }
}

struct SessionListResponse: Codable {
    let sessions: [WorkSession]
    let meta: SessionMeta?
}

struct SessionMeta: Codable {
    let total: Int
    let limit: Int
    let offset: Int
}
