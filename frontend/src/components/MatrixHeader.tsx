import { useSignal } from "@preact/signals";
import { showArchived } from "../stores/project-store";
import { addProject } from "../stores/project-store";
import { tags, selectedTagId, selectTag } from "../stores/tag-store";
import type { MatrixViewMode } from "./MatrixView";

interface Props {
  viewMode: MatrixViewMode;
  onViewChange: (mode: MatrixViewMode) => void;
}

export function MatrixHeader({ viewMode, onViewChange }: Props) {
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
    <div class="matrix-toolbar-wrapper">
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
        <div class="matrix-toolbar-right" style={{ gap: "0.5rem" }}>
          <div class="view-toggle-group">
            <button
              class={`view-toggle-btn ${viewMode === "matrix" ? "active" : ""}`}
              onClick={() => onViewChange("matrix")}
              title="グリッド表示"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              class={`view-toggle-btn ${viewMode === "card" ? "active" : ""}`}
              onClick={() => onViewChange("card")}
              title="カード表示"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="5" rx="1" />
                <rect x="3" y="11" width="18" height="5" rx="1" />
                <rect x="3" y="19" width="18" height="2" rx="1" />
              </svg>
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showArchived.value}
              onChange={(e) => (showArchived.value = (e.target as HTMLInputElement).checked)}
              style={{ width: "auto", marginRight: "0.375rem" }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>アーカイブ表示</span>
          </label>
        </div>
      </div>

      {tags.value.length > 0 && (
        <div class="tag-filter-bar">
          <button
            class={`tag-chip ${selectedTagId.value === null ? "tag-chip-active" : ""}`}
            onClick={() => selectTag(null)}
          >
            すべて
          </button>
          {tags.value.map((tag) => (
            <button
              key={tag.id}
              class={`tag-chip ${selectedTagId.value === tag.id ? "tag-chip-active" : ""}`}
              style={tag.color ? { "--tag-color": tag.color } as Record<string, string> : undefined}
              onClick={() => selectTag(selectedTagId.value === tag.id ? null : tag.id)}
            >
              {tag.color && <span class="tag-dot" />}
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
