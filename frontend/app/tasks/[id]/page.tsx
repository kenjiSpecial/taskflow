"use client";

import { use } from "react";
import { TaskDetail } from "@/components/task/TaskDetail";
import { TaskSidebar } from "@/components/task/TaskSidebar";
import { useTodo } from "@/lib/hooks/useTodos";

export default function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useTodo(id);

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!data?.todo) return <div className="p-6 text-gray-400">Not found</div>;

  const todo = data.todo;

  return (
    <div className="flex gap-6 p-6">
      <div className="w-72 shrink-0">
        <TaskSidebar todo={todo} />
      </div>
      <div className="flex-1 min-w-0">
        <TaskDetail todo={todo} />
      </div>
    </div>
  );
}
