const BRIDGE_URL = "http://localhost:19876";
const TIMEOUT_MS = 15_000;

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
