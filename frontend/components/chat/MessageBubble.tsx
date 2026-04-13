"use client";

import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.use({ breaks: true, async: false });

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const html = useMemo(() => {
    if (role === "assistant") {
      const raw = marked.parse(content) as string;
      return DOMPurify.sanitize(raw);
    }
    return "";
  }, [role, content]);

  if (role === "assistant") {
    return (
      <div className="flex justify-start">
        <div
          className="bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm max-w-[80%] prose prose-invert prose-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm max-w-[80%]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-500 px-3 py-1">
      {content}
    </div>
  );
}
