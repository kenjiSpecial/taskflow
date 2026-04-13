import { hideRealtimeNotice, realtimeNoticeMessage, realtimeNoticeUpdatedAt, realtimeNoticeVisible } from "../stores/realtime-notice-store";

function formatUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) return "";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(updatedAt));
  } catch {
    return "";
  }
}

export function RealtimeNoticeToast() {
  if (!realtimeNoticeVisible.value) return null;

  const updatedAtLabel = formatUpdatedAt(realtimeNoticeUpdatedAt.value);

  return (
    <aside class="realtime-toast" aria-live="polite" aria-atomic="true" role="status">
      <div class="realtime-toast__body">
        <span class="realtime-toast__dot" aria-hidden="true" />
        <div class="realtime-toast__copy">
          <p class="realtime-toast__title">{realtimeNoticeMessage.value}</p>
          {updatedAtLabel ? <p class="realtime-toast__meta">{updatedAtLabel}</p> : null}
        </div>
      </div>
      <button
        type="button"
        class="realtime-toast__close"
        onClick={hideRealtimeNotice}
        aria-label="更新通知を閉じる"
      >
        ✕
      </button>
    </aside>
  );
}
