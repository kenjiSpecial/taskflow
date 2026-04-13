const STORAGE_KEY = "taskflow-client-id";

let cachedClientId: string | null = null;

export function getClientId(): string {
  if (cachedClientId) return cachedClientId;

  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      cachedClientId = existing;
      return existing;
    }
  } catch {}

  const next = crypto.randomUUID();

  try {
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {}

  cachedClientId = next;
  return next;
}
