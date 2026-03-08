const BRIDGE_URL = "https://127.0.0.1:19876";
const TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 90_000;

export interface BridgeResult {
  ok: boolean;
  action?: "focused" | "created";
  message: string;
}

export async function bridgeOpenSession(
  sessionId: string,
): Promise<BridgeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BRIDGE_URL}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    });
    return (await res.json()) as BridgeResult;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Chat SSE ────────────────────────────────────────────────────────────────

export interface ChatSSECallbacks {
  onToken: (content: string) => void;
  onToolCall: (data: { tool_call_id: string; tool_name: string; args: Record<string, unknown> }) => void;
  onToolResult: (data: { tool_call_id: string; tool_name?: string; result?: unknown; cancelled?: boolean }) => void;
  onConfirm: (data: { tool_call_id: string; tool_name: string; args: Record<string, unknown>; description: string }) => void;
  onDone: (data: { conversation_id: string | null; model?: string }) => void;
  onError: (data: { message: string }) => void;
}

export interface ViewContext {
  currentPage: string;
  activeProjectId?: string;
  activeProjectName?: string;
  activeFilters?: {
    status?: string;
    tags?: string[];
  };
}

export function bridgeChat(
  message: string,
  callbacks: ChatSSECallbacks,
  options?: {
    conversation_id?: string;
    context?: ViewContext;
    history?: unknown[];
  },
): AbortController {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  void (async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_id: options?.conversation_id,
          context: options?.context,
          history: options?.history,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        callbacks.onError({ message: `HTTP ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "token":
                  callbacks.onToken(data.content);
                  break;
                case "tool_call":
                  callbacks.onToolCall(data);
                  break;
                case "tool_result":
                  callbacks.onToolResult(data);
                  break;
                case "confirm":
                  callbacks.onConfirm(data);
                  break;
                case "done":
                  callbacks.onDone(data);
                  break;
                case "error":
                  callbacks.onError(data);
                  break;
              }
            } catch {
              // ignore parse errors
            }
            currentEvent = "";
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        callbacks.onError({
          message: e instanceof Error ? e.message : "Connection failed",
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  })();

  return controller;
}

export async function bridgeConfirm(
  toolCallId: string,
  approved: boolean,
): Promise<void> {
  await fetch(`${BRIDGE_URL}/chat/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_call_id: toolCallId, approved }),
  });
}
