import SwiftUI

struct WaveSection: View {
    let wave: Wave?
    let todayWaves: [Wave]
    let onEnd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let wave {
                activeWaveView(wave)
            } else if !todayWaves.isEmpty {
                waveSummary
            }
        }
    }

    private func activeWaveView(_ wave: Wave) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("波\(wave.number)", systemImage: "water.waves")
                    .font(.subheadline.bold())
                    .foregroundStyle(.blue)
                Spacer()
                Button {
                    onEnd()
                } label: {
                    Text("終了")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
            }

            Text(wave.taskName)
                .font(.body)
                .lineLimit(2)

            HStack(spacing: 16) {
                if let elapsed = wave.elapsedMinutes {
                    Label("\(elapsed)分経過", systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let remaining = wave.remainingMinutes {
                    Label {
                        Text(remaining > 0 ? "残り\(remaining)分" : "延長中")
                    } icon: {
                        Image(systemName: remaining > 0 ? "timer" : "exclamationmark.circle")
                    }
                    .font(.caption)
                    .foregroundStyle(remaining > 10 ? Color.secondary : Color.orange)
                }
            }

            if let elapsed = wave.elapsedMinutes {
                let progress = min(1.0, Double(elapsed) / 90.0)
                ProgressView(value: progress)
                    .tint(progress >= 1.0 ? .orange : .blue)
            }
        }
        .padding(12)
        .background(.blue.opacity(0.05))
        .cornerRadius(8)
    }

    private var waveSummary: some View {
        HStack {
            Label("今日の波: \(todayWaves.count)", systemImage: "water.waves")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            if !todayWaves.compactMap(\.score).isEmpty {
                let total = todayWaves.compactMap(\.score).reduce(0, +)
                let count = todayWaves.compactMap(\.score).count
                Text("平均スコア: \(total / count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
