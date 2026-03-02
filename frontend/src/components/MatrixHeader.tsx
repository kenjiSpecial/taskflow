import { useSignal } from "@preact/signals";
import { showArchived } from "../stores/project-store";
import { addProject } from "../stores/project-store";

export function MatrixHeader() {
  const adding = useSignal(false);
  const name = useSignal("");
  const description = useSignal("");
  const submitting = useSignal(false);

  const handleAdd = async () => {
    const value = name.value.trim();
    if (!value || submitting.value) return;
    submitting.value = true;
    try {
      const desc = description.value.trim();
      await addProject({ name: value, ...(desc ? { description: desc } : {}) });
      name.value = "";
      description.value = "";
      adding.value = false;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      submitting.value = false;
    }
  };

  return (
    <div class="matrix-toolbar">
      <div class="matrix-toolbar-left">
        {adding.value ? (
          <div class="project-add-form">
            <input
              type="text"
              placeholder="プロジェクト名..."
              value={name.value}
              onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") (adding.value = false);
              }}
              // biome-ignore lint: autofocus is intentional
              autoFocus
              style={{ width: "200px" }}
            />
            <input
              type="text"
              placeholder="概要（任意）..."
              value={description.value}
              onInput={(e) => (description.value = (e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") (adding.value = false);
              }}
              style={{ width: "200px" }}
            />
            <button class="btn-primary" onClick={handleAdd} disabled={submitting.value}>
              追加
            </button>
            <button class="btn-ghost" onClick={() => (adding.value = false)}>
              キャンセル
            </button>
          </div>
        ) : (
          <button class="btn-ghost" onClick={() => (adding.value = true)}>
            + プロジェクト追加
          </button>
        )}
      </div>
      <label class="matrix-toolbar-right">
        <input
          type="checkbox"
          checked={showArchived.value}
          onChange={(e) => (showArchived.value = (e.target as HTMLInputElement).checked)}
          style={{ width: "auto", marginRight: "0.375rem" }}
        />
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>アーカイブ表示</span>
      </label>
    </div>
  );
}
