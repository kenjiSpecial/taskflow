import { signal } from "@preact/signals";

export const currentView = signal<"tasks" | "sessions">("tasks");
export const selectedSessionId = signal<string | null>(null);
