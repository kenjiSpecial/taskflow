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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-md mx-4">
        <p className="text-sm text-gray-200 mb-3">{description}</p>
        <div className="bg-gray-800 rounded p-2 text-xs text-gray-400 mb-4 overflow-auto max-h-40">
          <code>{JSON.stringify(args, null, 2)}</code>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded transition-colors"
            onClick={() => onConfirm(false)}
          >
            キャンセル
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
            onClick={() => onConfirm(true)}
          >
            実行
          </button>
        </div>
      </div>
    </div>
  );
}
