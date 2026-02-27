import { currentView } from "../stores/app-store";
import { selectedSessionId } from "../stores/app-store";

export function ViewToggle() {
  return (
    <div class="view-toggle">
      <button
        class={`view-toggle-btn ${currentView.value === "tasks" ? "active" : ""}`}
        onClick={() => {
          currentView.value = "tasks";
          selectedSessionId.value = null;
        }}
      >
        タスク
      </button>
      <button
        class={`view-toggle-btn ${currentView.value === "sessions" ? "active" : ""}`}
        onClick={() => {
          currentView.value = "sessions";
          selectedSessionId.value = null;
        }}
      >
        セッション
      </button>
    </div>
  );
}
