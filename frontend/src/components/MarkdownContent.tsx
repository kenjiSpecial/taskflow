import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "p", "br", "strong", "em", "del",
    "ul", "ol", "li", "a", "code", "pre", "blockquote", "hr",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

interface Props {
  content: string | null | undefined;
  class?: string;
}

export function MarkdownContent({ content, class: className }: Props) {
  if (!content) return null;

  const raw = marked.parse(content) as string;
  const html = DOMPurify.sanitize(raw, PURIFY_CONFIG);

  return (
    <div
      class={`prose prose-invert prose-sm max-w-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
