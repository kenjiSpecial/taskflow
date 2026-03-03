import { useSignal } from "@preact/signals";
import { Link } from "wouter-preact";
import { editProject, archiveProject, unarchiveProject, removeProject } from "../stores/project-store";
import { loadTodos } from "../stores/todo-store";
import { loadSessions } from "../stores/session-store";
import { loadProjects } from "../stores/project-store";
import { tags, linkProjectTag, unlinkProjectTag } from "../stores/tag-store";
import type { Tag } from "../lib/api";

interface Props {
  projectId: string | null;
  projectName: string;
  projectDescription: string | null;
  projectTags: Tag[];
  isArchived: boolean;
}

export function ProjectCell({ projectId, projectName, projectDescription, projectTags, isArchived }: Props) {
  const menuOpen = useSignal(false);
  const editing = useSignal(false);
  const tagging = useSignal(false);
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

  const handleTagToggle = async (tagId: string) => {
    if (!projectId) return;
    const isLinked = projectTags.some((t) => t.id === tagId);
    try {
      if (isLinked) {
        await unlinkProjectTag(projectId, tagId);
      } else {
        await linkProjectTag(projectId, tagId);
      }
      await loadProjects();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div class="project-cell-content">
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
      ) : tagging.value ? (
        <div class="project-tag-picker">
          <div class="tag-picker-list">
            {tags.value.map((tag) => {
              const isLinked = projectTags.some((t) => t.id === tag.id);
              return (
                <button
                  key={tag.id}
                  class={`tag-picker-item ${isLinked ? "tag-picker-active" : ""}`}
                  style={tag.color ? { "--tag-color": tag.color } as Record<string, string> : undefined}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  {tag.color && <span class="tag-dot" />}
                  {tag.name}
                  {isLinked && <span class="tag-check">✓</span>}
                </button>
              );
            })}
          </div>
          <button
            class="btn-ghost"
            onClick={() => (tagging.value = false)}
            style={{ fontSize: "0.6875rem", padding: "0.125rem 0.375rem", width: "100%", marginTop: "0.25rem" }}
          >
            閉じる
          </button>
        </div>
      ) : (
        <>
          <div class="project-cell-name">
            {projectId ? (
              <Link href={`/projects/${projectId}`} class="project-name-text" style={{ color: "inherit", textDecoration: "none" }}>
                {projectName}
              </Link>
            ) : (
              <span class="project-name-text">{projectName}</span>
            )}
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
                    <button
                      class="project-menu-item"
                      onClick={() => {
                        menuOpen.value = false;
                        tagging.value = true;
                      }}
                    >
                      タグ
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
          {projectTags.length > 0 && (
            <div class="project-tags">
              {projectTags.map((tag) => (
                <span
                  key={tag.id}
                  class="tag-mini"
                  style={tag.color ? { "--tag-color": tag.color } as Record<string, string> : undefined}
                >
                  {tag.color && <span class="tag-dot" />}
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
