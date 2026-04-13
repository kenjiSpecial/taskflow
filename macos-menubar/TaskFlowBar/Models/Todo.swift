import Foundation

struct Todo: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: String  // backlog | todo | ready_for_code | in_progress | review | done
    let priority: String  // high | medium | low
    let dueDate: String?
    let projectId: String?
    let parentId: String?
    let project: String?
    let sortOrder: Int?
    let doneAt: String?
    let deletedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, priority, project
        case dueDate = "due_date"
        case projectId = "project_id"
        case parentId = "parent_id"
        case sortOrder = "sort_order"
        case doneAt = "done_at"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isBacklog: Bool { status == "backlog" }
    var isTodo: Bool { status == "todo" }
    var isInProgress: Bool { status == "in_progress" }
    var isReview: Bool { status == "review" }
    var isDone: Bool { status == "done" }
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
