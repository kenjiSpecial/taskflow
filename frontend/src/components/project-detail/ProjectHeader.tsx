import { Link } from "wouter-preact";
import type { Project, Tag } from "../../lib/api";

interface Props {
  project: Project;
}

export function ProjectHeader({ project }: Props) {
  const colorStyle = project.color
    ? { borderLeftColor: project.color }
    : {};

  return (
    <div class="mb-6">
      <Link href="/" class="inline-flex items-center gap-1 text-sm text-app-text-muted hover:text-app-accent mb-3">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        MatrixView
      </Link>

      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h1
            class="text-xl font-semibold text-app-text border-l-4 border-app-border pl-3"
            style={colorStyle}
          >
            {project.name}
          </h1>
          {project.description && (
            <p class="text-sm text-app-text-muted mt-1 pl-3 ml-1">{project.description}</p>
          )}
          {project.tags && project.tags.length > 0 && (
            <div class="flex gap-1.5 flex-wrap mt-2 pl-3 ml-1">
              {project.tags.map((tag: Tag) => (
                <span
                  key={tag.id}
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-app-surface text-app-text-muted"
                >
                  {tag.color && (
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ビュー切り替え（ダッシュボードのみアクティブ） */}
        <div class="flex gap-1">
          <button
            class="p-1.5 rounded-md bg-app-accent text-white"
            title="ダッシュボード"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            class="p-1.5 rounded-md text-app-text-muted opacity-40 cursor-not-allowed"
            title="カード（準備中）"
            disabled
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>
          <button
            class="p-1.5 rounded-md text-app-text-muted opacity-40 cursor-not-allowed"
            title="看板（準備中）"
            disabled
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </button>
          <button
            class="p-1.5 rounded-md text-app-text-muted opacity-40 cursor-not-allowed"
            title="タイムライン（準備中）"
            disabled
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
