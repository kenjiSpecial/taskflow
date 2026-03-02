import { Link } from "wouter-preact";

export function NotFound() {
  return (
    <div class="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h1 class="text-4xl font-bold text-app-text-muted mb-2">404</h1>
      <p class="text-app-text-muted mb-4">ページが見つかりません</p>
      <Link href="/" class="text-app-accent hover:text-app-accent-hover">
        MatrixView に戻る
      </Link>
    </div>
  );
}
