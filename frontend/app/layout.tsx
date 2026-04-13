import type { Metadata } from "next";
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
      <body>
        <Providers>
          <div className="flex h-screen">
            <main className="flex-1 overflow-auto">{children}</main>
            <ChatPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}
