"use client";

interface ConfirmDialogProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
  onConfirm: (approved: boolean) => void;
}

export function ConfirmDialog({
  toolName: _toolName,
  args,
  description,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div className="chat-confirm-overlay">
      <div className="chat-confirm-dialog">
        <p className="chat-confirm-text">{description}</p>
        <div className="chat-confirm-details">
          <code>{JSON.stringify(args, null, 2)}</code>
        </div>
        <div className="chat-confirm-actions">
          <button className="btn-ghost" onClick={() => onConfirm(false)}>
            キャンセル
          </button>
          <button className="btn-danger" onClick={() => onConfirm(true)}>
            実行
          </button>
        </div>
      </div>
    </div>
  );
}
