import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "タスク・スケジュール管理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><Providers><main>{children}</main></Providers></body>
    </html>
  );
}
