"use client";

import { use } from "react";
import { SessionDetail } from "@/components/session/SessionDetail";
import { useSession } from "@/lib/hooks/useSessions";

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useSession(id);

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!data?.session) return <div className="p-6 text-gray-400">Not found</div>;

  return (
    <div className="p-6">
      <SessionDetail session={data.session} />
    </div>
  );
}
