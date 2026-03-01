import { useSignal } from "@preact/signals";
import { editProject, archiveProject, unarchiveProject, removeProject } from "../stores/project-store";
import { loadTodos } from "../stores/todo-store";
import { loadSessions } from "../stores/session-store";
import { loadProjects } from "../stores/project-store";

interface Props {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  isArchived: boolean;
}

export function ProjectCell({ projectId, projectName, projectColor, isArchived }: Props) {
  const menuOpen = useSignal(false);
  const renaming = useSignal(false);
  const newName = useSignal(projectName);

  const handleRename = async () => {
    if (!projectId) return;
    const value = newName.value.trim();
    if (value && value !== projectName) {
      try {
        await editProject(projectId, { name: value });
      } catch (e) {
        alert((e as Error).message);
      }
    }
    renaming.value = false;
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
      {renaming.value ? (
        <input
          type="text"
          value={newName.value}
          onInput={(e) => (newName.value = (e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") (renaming.value = false);
          }}
          onBlur={handleRename}
          // biome-ignore lint: autofocus is intentional
          autoFocus
          style={{ fontSize: "0.8125rem", padding: "0.25rem 0.375rem" }}
        />
      ) : (
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
                      renaming.value = true;
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
      )}
    </div>
  );
}
