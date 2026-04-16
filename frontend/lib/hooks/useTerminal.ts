"use client";
import { useEffect, useRef, useCallback, useState } from "react";

// chat-bridge のWebSocket URL
const BRIDGE_WS_BASE = "wss://127.0.0.1:19876";

export interface UseTerminalOptions {
  todoId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  zellijSession?: string;
}

export interface UseTerminalReturn {
  isConnected: boolean;
  isConnecting: boolean;
  fit: () => void;
}

export function useTerminal({
  todoId,
  containerRef,
  enabled,
  zellijSession,
}: UseTerminalOptions): UseTerminalReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingMessagesRef = useRef<string[]>([]);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !containerRef.current || !termRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    isReadyRef.current = false;
    pendingMessagesRef.current = [];
    const url = zellijSession
      ? `${BRIDGE_WS_BASE}/ws/terminal/${todoId}?zellij=${encodeURIComponent(zellijSession)}`
      : `${BRIDGE_WS_BASE}/ws/terminal/${todoId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const sendOrQueue = (payload: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!isReadyRef.current) {
        pendingMessagesRef.current.push(payload);
        return;
      }
      ws.send(payload);
    };

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      // readyはサーバのready受信時に確定。先にresizeをキューに積んでおく
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = termRef.current;
        sendOrQueue(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: string;
          pid?: number;
          code?: number;
          message?: string;
        };
        if (msg.type === "ready") {
          isReadyRef.current = true;
          setIsConnected(true);
          setIsConnecting(false);
          retryCountRef.current = 0;
          // 溜まっていた送信を吐き出す
          for (const payload of pendingMessagesRef.current) ws.send(payload);
          pendingMessagesRef.current = [];
        } else if (msg.type === "output" && msg.data) {
          termRef.current?.write(msg.data);
        } else if (msg.type === "exit") {
          isReadyRef.current = false;
          setIsConnected(false);
        } else if (msg.type === "error") {
          termRef.current?.write(`\r\n\x1b[31m[error: ${msg.message}]\x1b[0m\r\n`);
        }
      } catch (e) {
        console.error("[term] onmessage error:", e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      isReadyRef.current = false;
      pendingMessagesRef.current = [];
      setIsConnected(false);
      setIsConnecting(false);
      // 自動再接続（最大3回）
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      setIsConnecting(false);
    };
  }, [todoId, containerRef, zellijSession]);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    // Per-effect abort flag: StrictMode で前の effect が cleanup された後に
    // この IIFE が import 終了してもリソースを作らない
    let aborted = false;

    let terminal: import("@xterm/xterm").Terminal;
    let fitAddon: import("@xterm/addon-fit").FitAddon;
    let resizeObserver: ResizeObserver;

    (async () => {
      if (aborted || !containerRef.current || !mountedRef.current) return;

      // xterm.js は動的インポート（SSR回避）。CSS は TerminalPanel.tsx で静的 import 済み
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (aborted || !mountedRef.current || !containerRef.current) return;

      // StrictMode の二重 mount 対策: 既存インスタンスがあれば破棄してから再作成
      if (termRef.current) {
        try { termRef.current.dispose(); } catch { /* ignore */ }
        termRef.current = null;
      }
      // 既存のWebSocketもクローズ（StrictMode で前 effect が残している可能性）
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
      // containerRef.current の中身も一旦クリア（前回 open した DOM 残骸を除去）
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      terminal = new Terminal({
        theme: {
          background: "#111827",
          foreground: "#f3f4f6",
          cursor: "#60a5fa",
          // Dracula カラーパレット（ls / Claude Code のカラー表示用）
          black:         "#1a1a2e",
          red:           "#ff5555",
          green:         "#50fa7b",
          yellow:        "#f1fa8c",
          blue:          "#6272a4",
          magenta:       "#ff79c6",
          cyan:          "#8be9fd",
          white:         "#bfbfbf",
          brightBlack:   "#6272a4",
          brightRed:     "#ff6e6e",
          brightGreen:   "#69ff94",
          brightYellow:  "#ffffa5",
          brightBlue:    "#d6acff",
          brightMagenta: "#ff92df",
          brightCyan:    "#a4ffff",
          brightWhite:   "#ffffff",
        },
        fontFamily: '"FiraCode Nerd Font Mono", "FiraCode NFM", "JetBrainsMono Nerd Font Mono", "JetBrainsMono NFM", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        scrollback: 1000,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      termRef.current = terminal;
      fitAddonRef.current = fitAddon;

      const sendOrQueuePersistent = (payload: string) => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;
        if (!isReadyRef.current) {
          pendingMessagesRef.current.push(payload);
          return;
        }
        ws.send(payload);
      };

      // ターミナル入力 → WebSocket（ready前はキュー）
      terminal.onData((data) => {
        sendOrQueuePersistent(JSON.stringify({ type: "input", data }));
      });

      // Cmd+V / Ctrl+V のペーストを明示処理（Clipboard API 経由で確実に送信）
      terminal.attachCustomKeyEventHandler((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "v" && e.type === "keydown") {
          navigator.clipboard.readText().then((text) => {
            if (text) sendOrQueuePersistent(JSON.stringify({ type: "input", data: text }));
          }).catch(() => { /* clipboard 権限なしの場合は xterm デフォルトに任せる */ });
          return false;
        }
        return true;
      });

      // コンテナリサイズ → ターミナルリサイズ（ready前はキュー）
      resizeObserver = new ResizeObserver(() => {
        if (!fitAddonRef.current || !termRef.current) return;
        fitAddonRef.current.fit();
        const { cols, rows } = termRef.current;
        sendOrQueuePersistent(JSON.stringify({ type: "resize", cols, rows }));
      });
      resizeObserver.observe(containerRef.current);

      await connect();
    })();

    return () => {
      aborted = true;
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      isReadyRef.current = false;
      pendingMessagesRef.current = [];
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      retryCountRef.current = 0;
    };
  }, [enabled, connect, containerRef]);

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return;
    fitAddonRef.current.fit();
    const { cols, rows } = termRef.current;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && isReadyRef.current) {
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  return { isConnected, isConnecting, fit };
}
