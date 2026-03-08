import { signal, computed } from "@preact/signals";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  tool_name?: string;
  created_at: string;
}

export interface ToolExecution {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  status: "executing" | "done" | "cancelled" | "error";
  result?: unknown;
}

export interface PendingConfirmation {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  description: string;
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export const isChatOpen = signal(false);
export const messages = signal<ChatMessage[]>([]);
export const conversationId = signal<string | null>(null);
export const isStreaming = signal(false);
export const streamingContent = signal("");
export const error = signal<string | null>(null);
export const toolExecutions = signal<ToolExecution[]>([]);
export const pendingConfirmation = signal<PendingConfirmation | null>(null);

export const hasMessages = computed(() => messages.value.length > 0);

// ─── Actions ─────────────────────────────────────────────────────────────────

export function toggleChat() {
  isChatOpen.value = !isChatOpen.value;
}

export function openChat() {
  isChatOpen.value = true;
}

export function closeChat() {
  isChatOpen.value = false;
}

export function addUserMessage(content: string): ChatMessage {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    created_at: new Date().toISOString(),
  };
  messages.value = [...messages.value, msg];
  return msg;
}

export function addAssistantMessage(content: string): ChatMessage {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    created_at: new Date().toISOString(),
  };
  messages.value = [...messages.value, msg];
  return msg;
}

export function startNewConversation() {
  messages.value = [];
  conversationId.value = null;
  streamingContent.value = "";
  error.value = null;
  toolExecutions.value = [];
  pendingConfirmation.value = null;
}

export function updateToolExecution(
  toolCallId: string,
  update: Partial<ToolExecution>,
) {
  toolExecutions.value = toolExecutions.value.map((te) =>
    te.tool_call_id === toolCallId ? { ...te, ...update } : te,
  );
}

export function addToolExecution(te: ToolExecution) {
  toolExecutions.value = [...toolExecutions.value, te];
}
