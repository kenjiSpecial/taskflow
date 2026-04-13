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
      <div className="chat-message chat-message-assistant">
        <div
          className="chat-message-content chat-markdown"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <div className={`chat-message chat-message-${role}`}>
      <div className="chat-message-content">{content}</div>
    </div>
  );
}
