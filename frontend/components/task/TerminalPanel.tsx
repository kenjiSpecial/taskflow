"use client";
import { useRef, useState, useEffect } from "react";
import "@xterm/xterm/css/xterm.css";
import { useTerminal } from "@/lib/hooks/useTerminal";

const BRIDGE_BASE = "https://127.0.0.1:19876";

interface TerminalPanelProps {
  todoId: string;
  workspaceZellijSession?: string | null;
  onZellijChange?: (session: string) => void;
}

export function TerminalPanel({ todoId, workspaceZellijSession, onZellijChange }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zellijSessions, setZellijSessions] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>(workspaceZellijSession ?? "");
  const [copied, setCopied] = useState(false);
  const knownSessionsRef = useRef<Set<string>>(new Set());

  // workspaceZellijSession が変わったら selectedSession を追従
  useEffect(() => {
    setSelectedSession(workspaceZellijSession ?? "");
  }, [workspaceZellijSession]);

  const { isConnected, isConnecting, fit } = useTerminal({
    todoId,
    containerRef,
    enabled: true,
    zellijSession: selectedSession || undefined,
  });

  // 初回 Zellij セッション一覧取得 + スナップショット保存
  useEffect(() => {
    fetch(`${BRIDGE_BASE}/zellij/sessions`, { mode: "cors" })
      .then((r) => r.json())
      .then((d: { sessions: string[] }) => {
        const sessions = d.sessions ?? [];
        setZellijSessions(sessions);
        knownSessionsRef.current = new Set(sessions);
      })
      .catch(() => {});
  }, []);

  // shellモードで接続中のとき、新規 Zellij セッションを自動検出
  useEffect(() => {
    if (selectedSession || !isConnected) return;
    const interval = setInterval(() => {
      fetch(`${BRIDGE_BASE}/zellij/sessions`, { mode: "cors" })
        .then((r) => r.json())
        .then((d: { sessions: string[] }) => {
          const sessions = d.sessions ?? [];
          setZellijSessions(sessions);
          const newSession = sessions.find((s) => !knownSessionsRef.current.has(s));
          if (newSession) {
            setSelectedSession(newSession);
            onZellijChange?.(newSession);
            knownSessionsRef.current = new Set(sessions);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSession, isConnected, onZellijChange]);

  // 全画面切り替え後に xterm をリサイズ
  useEffect(() => {
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, [isFullscreen, fit]);

  // Escape キーで全画面解除
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const header = (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
      {/* Zellij セッション選択 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-400 font-mono shrink-0">Terminal</span>
        {zellijSessions.length > 0 && (
          <select
            value={selectedSession}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedSession(v);
              onZellijChange?.(v);
            }}
            className="text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded px-1.5 py-0.5 max-w-[160px] truncate cursor-pointer hover:border-gray-500 focus:outline-none focus:border-blue-500"
          >
            <option value="">shell</option>
            {zellijSessions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {/* セッション名コピーボタン */}
        {selectedSession && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedSession).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }).catch(() => {});
            }}
            className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-600 transition-colors cursor-pointer shrink-0"
            title="セッション名をコピー"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* 接続ステータス */}
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
        {/* 全画面トグルボタン */}
        <button
          onClick={() => setIsFullscreen((v) => !v)}
          className="flex items-center justify-center w-9 h-9 rounded-md text-gray-400 hover:text-white hover:bg-gray-600 active:bg-gray-500 transition-colors cursor-pointer"
          title={isFullscreen ? "通常表示 (Esc)" : "全画面表示"}
        >
          {isFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V3h4" />
              <path d="M17 3h4v4" />
              <path d="M21 17v4h-4" />
              <path d="M7 21H3v-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
        {header}
        <div
          ref={containerRef}
          className="flex-1 bg-gray-900"
          style={{ padding: "4px" }}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
      {header}
      <div
        ref={containerRef}
        className="bg-gray-900"
        style={{ height: "500px", padding: "4px" }}
      />
    </div>
  );
}
