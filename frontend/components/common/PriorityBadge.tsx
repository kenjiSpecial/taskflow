"use client";

type Priority = "high" | "medium" | "low";

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; icon: string }
> = {
  high: { label: "High", color: "text-red-400", icon: "!!!" },
  medium: { label: "Medium", color: "text-yellow-400", icon: "!!" },
  low: { label: "Low", color: "text-gray-400", icon: "!" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <span className="font-bold">{config.icon}</span>
      {config.label}
    </span>
  );
}
