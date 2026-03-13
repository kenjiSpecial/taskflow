import Foundation

struct Todo: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: String  // pending | in_progress | completed
    let priority: String  // high | medium | low
    let dueDate: String?
    let projectId: String?
    let parentId: String?
    let project: String?
    let sortOrder: Int?
    let completedAt: String?
    let deletedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, priority, project
        case dueDate = "due_date"
        case projectId = "project_id"
        case parentId = "parent_id"
        case sortOrder = "sort_order"
        case completedAt = "completed_at"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isPending: Bool { status == "pending" }
    var isInProgress: Bool { status == "in_progress" }
    var isCompleted: Bool { status == "completed" }
    var isHighPriority: Bool { priority == "high" }
    var isMediumPriority: Bool { priority == "medium" }
    var isLowPriority: Bool { priority == "low" }
}

struct TodoListResponse: Codable {
    let todos: [Todo]
    let meta: TodoMeta
}

struct TodoMeta: Codable {
    let total: Int
    let limit: Int
    let offset: Int
}

struct TodayTodosResponse: Codable {
    let todos: [Todo]
    let date: String?
    let timezone: String?
}
