import { useSignal } from "@preact/signals";
import { bridgeOpenSession } from "../lib/bridge";

type CmuxState = "idle" | "loading" | "success" | "focused" | "error" | "fallback";

interface Props {
  sessionId: string;
}

export function CmuxCopyButton({ sessionId }: Props) {
  const state = useSignal<CmuxState>("idle");

  const handleClick = async (e: Event) => {
    e.stopPropagation();
    if (state.value === "loading") return;

    state.value = "loading";
    try {
      const result = await bridgeOpenSession(sessionId);
      if (result.ok) {
        state.value = result.action === "focused" ? "focused" : "success";
      } else {
        state.value = "error";
      }
      setTimeout(() => { state.value = "idle"; }, 2000);
    } catch {
      // Server unreachable — fallback to clipboard
      const cmd = `taskflow-cmux start ${sessionId}`;
      try {
        await navigator.clipboard.writeText(cmd);
      } catch {
        // clipboard also failed
      }
      state.value = "fallback";
      setTimeout(() => { state.value = "idle"; }, 3000);
    }
  };

  const title =
    state.value === "loading" ? "workspace を開いています..." :
    state.value === "success" ? "workspace を作成しました" :
    state.value === "focused" ? "workspace にフォーカスしました" :
    state.value === "error" ? "エラーが発生しました" :
    state.value === "fallback" ? "コマンドをコピーしました（サーバー未起動）" :
    "cmux workspace を開く";

  return (
    <span class="cmux-btn-wrapper">
      <button
        class={`btn-ghost cmux-copy-btn ${state.value}`}
        onClick={handleClick}
        disabled={state.value === "loading"}
        title={title}
      >
        {state.value === "loading" && (
          <svg class="cmux-spinner" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
        {(state.value === "success" || state.value === "focused") && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state.value === "error" && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--danger, #ef4444)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {(state.value === "idle" || state.value === "fallback") && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </button>
      {state.value === "fallback" && (
        <span class="cmux-fallback-notice">
          コピー済 — taskflow-cmux serve を起動してください
        </span>
      )}
    </span>
  );
}
