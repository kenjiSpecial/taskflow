import Foundation

struct CmuxMappings: Codable {
    let mappings: [CmuxMapping]
}

struct CmuxMapping: Codable {
    let sessionId: String
    let workspaceId: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case workspaceId = "workspace_id"
        case createdAt = "created_at"
    }
}
