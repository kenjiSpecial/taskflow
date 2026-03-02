import { Link } from "wouter-preact";

interface Props {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: Props) {
  return (
    <div class="p-4">
      <Link href="/" class="text-app-accent hover:text-app-accent-hover text-sm">
        ← MatrixView に戻る
      </Link>
      <h1 class="text-xl font-semibold mt-4">Project: {projectId}</h1>
      <p class="text-app-text-muted mt-2">Coming soon...</p>
    </div>
  );
}
