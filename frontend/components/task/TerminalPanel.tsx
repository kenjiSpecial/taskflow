"use client";
import { useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { useTerminal } from "@/lib/hooks/useTerminal";

interface TerminalPanelProps {
  todoId: string;
}

export function TerminalPanel({ todoId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isConnected, isConnecting } = useTerminal({
    todoId,
    containerRef,
    enabled: true,
  });

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">Terminal</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-green-400"
                : isConnecting
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? "connected" : isConnecting ? "connecting..." : "disconnected"}
          </span>
        </div>
      </div>
      {/* xterm.js コンテナ */}
      <div
        ref={containerRef}
        className="bg-gray-900"
        style={{ height: "300px", padding: "4px" }}
      />
    </div>
  );
}
