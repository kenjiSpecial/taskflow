import Foundation

struct Wave: Identifiable, Sendable {
    let id = UUID()
    let number: Int
    let startTime: String      // "HH:MM"
    let endTime: String?       // nil = active
    let taskName: String
    let score: Int?            // 1-5, nil = active

    var isActive: Bool { endTime == nil }

    /// 開始時刻からDateを生成（今日の日付で）
    var startDate: Date? {
        Self.timeToDate(startTime)
    }

    var endDate: Date? {
        guard let end = endTime else { return nil }
        return Self.timeToDate(end)
    }

    /// 経過時間（分）
    var elapsedMinutes: Int? {
        guard let start = startDate else { return nil }
        let end = endDate ?? Date()
        return max(0, Int(end.timeIntervalSince(start) / 60))
    }

    /// 90分波の残り時間（分）
    var remainingMinutes: Int? {
        guard let elapsed = elapsedMinutes else { return nil }
        return max(0, 90 - elapsed)
    }

    /// 所要時間からスコアを計算
    static func calculateScore(minutes: Int) -> Int {
        switch minutes {
        case 0..<20: return 1
        case 20..<40: return 2
        case 40..<60: return 3
        case 60..<80: return 4
        default: return 5
        }
    }

    private static func timeToDate(_ time: String) -> Date? {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return nil }
        let cal = Calendar.current
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: Date())
    }
}

enum AppMode {
    case focus  // 波アクティブ
    case admin  // 波なし
}
