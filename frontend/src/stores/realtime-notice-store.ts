import { signal } from "@preact/signals";

const NOTICE_DURATION_MS = 3500;
const DEFAULT_MESSAGE = "データが更新されました";

export const realtimeNoticeVisible = signal(false);
export const realtimeNoticeMessage = signal(DEFAULT_MESSAGE);
export const realtimeNoticeUpdatedAt = signal<string | null>(null);

let hideTimer: number | null = null;

function clearHideTimer() {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function showRealtimeNotice(message = DEFAULT_MESSAGE) {
  clearHideTimer();
  realtimeNoticeMessage.value = message;
  realtimeNoticeUpdatedAt.value = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  realtimeNoticeVisible.value = true;

  hideTimer = window.setTimeout(() => {
    realtimeNoticeVisible.value = false;
    hideTimer = null;
  }, NOTICE_DURATION_MS);
}

export function hideRealtimeNotice() {
  clearHideTimer();
  realtimeNoticeVisible.value = false;
  realtimeNoticeUpdatedAt.value = null;
}
