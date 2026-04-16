"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.use({ breaks: true, async: false });

function linkifyRefs(text: string): string {
  return text
    .replace(/\[タスク: ([^\]]+?) \(ID: ([0-9a-f-]+)\)\]/g, (_, title, id) => {
      const escaped = title.replace(/[[\]()]/g, "\\$&");
      return `[タスク: ${escaped}](/tasks/${id})`;
    })
    .replace(/\[プロジェクト: ([^\]]+?) \(ID: ([0-9a-f-]+)\)\]/g, (_, title, id) => {
      const escaped = title.replace(/[[\]()]/g, "\\$&");
      return `[プロジェクト: ${escaped}](/projects/${id})`;
    });
}

function renderHtml(text: string): string {
  const raw = marked.parse(linkifyRefs(text)) as string;
  return DOMPurify.sanitize(raw);
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const router = useRouter();
  const html = useMemo(() => {
    if (role === "assistant" || role === "user") {
      return renderHtml(content);
    }
    return "";
  }, [role, content]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (href.startsWith("/tasks/") || href.startsWith("/projects/")) {
      e.preventDefault();
      router.push(href);
    }
  }

  if (role === "assistant") {
    return (
      <div className="flex justify-start">
        <div
          className="bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm max-w-[80%] prose prose-invert prose-sm"
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={handleClick}
        />
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm max-w-[80%] prose prose-invert prose-sm [&_a]:text-blue-200 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={handleClick}
        />
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-500 px-3 py-1">
      {content}
    </div>
  );
}
