import SwiftUI

struct WaveStartSheet: View {
    @Environment(AppState.self) var appState
    @Binding var isPresented: Bool
    @State private var taskName: String
    let initialTaskName: String

    init(isPresented: Binding<Bool>, taskName: String) {
        _isPresented = isPresented
        _taskName = State(initialValue: taskName)
        initialTaskName = taskName
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("波を開始")
                .font(.headline)

            TextField("タスク名", text: $taskName)
                .textFieldStyle(.roundedBorder)

            HStack {
                Button("キャンセル") {
                    isPresented = false
                }
                .keyboardShortcut(.escape)

                Spacer()

                Button("開始") {
                    appState.waveService.startWave(taskName: taskName)
                    isPresented = false
                }
                .keyboardShortcut(.return)
                .disabled(taskName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(16)
        .frame(width: 280)
    }
}
