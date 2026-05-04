import { AuthButton } from "@/components/common/AuthButton";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">shopping-list-app</h1>
        <AuthButton />
      </header>
      <p className="text-gray-600">買い物リストアプリ — 初期テンプレート</p>
    </main>
  );
}
