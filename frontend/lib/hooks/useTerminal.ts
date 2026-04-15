"use client";
import { useEffect, useRef, useCallback, useState } from "react";

// chat-bridge のWebSocket URL
const BRIDGE_WS_BASE = "wss://127.0.0.1:19876";

export interface UseTerminalOptions {
  todoId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
}

export interface UseTerminalReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export function useTerminal({
  todoId,
  containerRef,
  enabled,
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
    const url = `${BRIDGE_WS_BASE}/ws/terminal/${todoId}`;
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
        } else if (msg.type === "output" && msg.data && termRef.current) {
          termRef.current.write(msg.data);
        } else if (msg.type === "exit") {
          isReadyRef.current = false;
          setIsConnected(false);
        } else if (msg.type === "error") {
          termRef.current?.write(`\r\n\x1b[31m[error: ${msg.message}]\x1b[0m\r\n`);
        }
      } catch { /* ignore */ }
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
  }, [todoId, containerRef]);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    let terminal: import("@xterm/xterm").Terminal;
    let fitAddon: import("@xterm/addon-fit").FitAddon;
    let resizeObserver: ResizeObserver;

    (async () => {
      if (!containerRef.current || !mountedRef.current) return;

      // xterm.js は動的インポート（SSR回避）
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (!mountedRef.current || !containerRef.current) return;

      terminal = new Terminal({
        theme: {
          background: "#111827", // gray-900
          foreground: "#f3f4f6",
          cursor: "#60a5fa",
        },
        fontFamily: "\"Fira Code\", \"Cascadia Code\", \"JetBrains Mono\", monospace",
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

  return { isConnected, isConnecting };
}
