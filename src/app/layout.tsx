import type { Metadata } from "next";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { SyncProvider } from "@/components/providers/SyncProvider";
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
        <SessionProvider>
          <SyncProvider>{children}</SyncProvider>
        </SessionProvider>
        <Toaster
          position="bottom-center"
          duration={1500}
          richColors
          closeButton={false}
        />
      </body>
    </html>
  );
}
