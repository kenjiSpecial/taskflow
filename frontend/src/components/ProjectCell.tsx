import { useSignal } from "@preact/signals";
import { editProject, archiveProject, unarchiveProject, removeProject } from "../stores/project-store";
import { loadTodos } from "../stores/todo-store";
import { loadSessions } from "../stores/session-store";
import { loadProjects } from "../stores/project-store";

interface Props {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  projectDescription: string | null;
  isArchived: boolean;
}

export function ProjectCell({ projectId, projectName, projectColor, projectDescription, isArchived }: Props) {
  const menuOpen = useSignal(false);
  const editing = useSignal(false);
  const newName = useSignal(projectName);
  const newDescription = useSignal(projectDescription ?? "");

  const handleSave = async () => {
    if (!projectId) return;
    const name = newName.value.trim();
    if (!name) { editing.value = false; return; }
    const desc = newDescription.value.trim();
    const updates: Record<string, string | null> = {};
    if (name !== projectName) updates.name = name;
    if (desc !== (projectDescription ?? "")) updates.description = desc || null;
    if (Object.keys(updates).length > 0) {
      try {
        await editProject(projectId, updates);
      } catch (e) {
        alert((e as Error).message);
      }
    }
    editing.value = false;
  };

  const handleArchive = async () => {
    if (!projectId) return;
    menuOpen.value = false;
    if (isArchived) {
      await unarchiveProject(projectId);
    } else {
      await archiveProject(projectId);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    menuOpen.value = false;
    if (!window.confirm(`プロジェクト「${projectName}」を削除しますか？\n配下のタスク・セッションは未分類に移動します。`)) return;
    await removeProject(projectId);
    await Promise.all([loadTodos(), loadSessions(), loadProjects()]);
  };

  const colorStyle = projectColor
    ? { borderLeft: `3px solid ${projectColor}` }
    : {};

  return (
    <div class={`matrix-cell matrix-project-cell ${isArchived ? "archived" : ""}`} style={colorStyle}>
      {editing.value ? (
        <div class="project-edit-form">
          <input
            type="text"
            value={newName.value}
            onInput={(e) => (newName.value = (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") (editing.value = false);
            }}
            placeholder="プロジェクト名"
            // biome-ignore lint: autofocus is intentional
            autoFocus
            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.375rem" }}
          />
          <textarea
            value={newDescription.value}
            onInput={(e) => (newDescription.value = (e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
              if (e.key === "Escape") (editing.value = false);
            }}
            placeholder="概要（任意）"
            rows={2}
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.375rem", resize: "vertical" }}
          />
          <div class="project-edit-actions">
            <button class="btn-primary" onClick={handleSave} style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>保存</button>
            <button class="btn-ghost" onClick={() => (editing.value = false)} style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>キャンセル</button>
          </div>
        </div>
      ) : (
        <>
          <div class="project-cell-name">
            <span class="project-name-text">{projectName}</span>
            {projectId && (
              <div class="project-menu-wrapper">
                <button
                  class="btn-ghost project-menu-btn"
                  onClick={() => (menuOpen.value = !menuOpen.value)}
                >
                  ...
                </button>
                {menuOpen.value && (
                  <div class="project-menu">
                    <button
                      class="project-menu-item"
                      onClick={() => {
                        menuOpen.value = false;
                        newName.value = projectName;
                        newDescription.value = projectDescription ?? "";
                        editing.value = true;
                      }}
                    >
                      編集
                    </button>
                    <button class="project-menu-item" onClick={handleArchive}>
                      {isArchived ? "アーカイブ解除" : "アーカイブ"}
                    </button>
                    <button class="project-menu-item project-menu-danger" onClick={handleDelete}>
                      削除
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {projectDescription && (
            <div class="project-description">{projectDescription}</div>
          )}
        </>
      )}
    </div>
  );
}
