const BRIDGE_URL = "http://localhost:19876";
const TIMEOUT_MS = 15_000;

interface BridgeResult {
  ok: boolean;
  message: string;
}

export async function bridgeStartSession(
  sessionId: string,
): Promise<BridgeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BRIDGE_URL}/start`, {
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
