import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import { ChatPanel } from "@/components/chat/ChatPanel";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "タスク・スケジュール管理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-950 text-gray-100">
        <Providers>
          <div className="flex h-screen">
            <div className="flex-1 flex flex-col overflow-hidden">
              <nav className="flex items-center gap-6 px-6 py-3 border-b border-gray-800 bg-gray-950">
                <Link href="/" className="font-bold text-white">TaskFlow</Link>
                <Link href="/projects" className="text-gray-400 hover:text-white transition-colors">プロジェクト</Link>
                <Link href="/sessions" className="text-gray-400 hover:text-white transition-colors">セッション</Link>
              </nav>
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
            <ChatPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}
