"use client";

import { use } from "react";
import { ProjectDetail } from "@/components/project/ProjectDetail";
import { useProject } from "@/lib/hooks/useProjects";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useProject(id);

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!data?.project) return <div className="p-6 text-gray-400">Not found</div>;

  return (
    <div className="p-6">
      <ProjectDetail project={data.project} />
    </div>
  );
}
