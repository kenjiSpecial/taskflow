"use client";

import { useState, useCallback } from "react";

interface Props {
  generatePrompt: () => string;
}

export function LLMCopyButton({ generatePrompt }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = generatePrompt();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatePrompt]);

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
    >
      {copied ? "Copied" : "LLM Prompt"}
    </button>
  );
}
