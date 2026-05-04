import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shopping-list-app",
  description: "買い物リストアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
