import { useSignal } from "@preact/signals";

interface Props {
  sessionId: string;
}

export function CmuxCopyButton({ sessionId }: Props) {
  const copied = useSignal(false);

  const handleClick = async (e: Event) => {
    e.stopPropagation();
    const cmd = `taskflow-cmux start ${sessionId}`;
    try {
      await navigator.clipboard.writeText(cmd);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 1500);
    } catch {
      // fallback
    }
  };

  return (
    <button
      class="btn-ghost cmux-copy-btn"
      onClick={handleClick}
      title="cmux start コマンドをコピー"
    >
      {copied.value ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )}
    </button>
  );
}
