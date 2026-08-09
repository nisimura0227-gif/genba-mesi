"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Field";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "ログインに失敗しました。");
        setSubmitting(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-canvas px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <img src="/icon.svg" alt="" width={56} height={56} className="rounded-2xl bg-brand-gradient p-2 shadow-card" />
        <h1 className="text-xl font-bold text-brand-dark">管理者ログイン</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-card">
        <div>
          <FieldLabel>パスワード</FieldLabel>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}
        <Button type="submit" size="lg" disabled={submitting || !password}>
          {submitting ? "確認中..." : "ログイン"}
        </Button>
      </form>
      <Link href="/" className="mt-8 text-center text-sm text-gray-400 underline">
        トップページへ戻る
      </Link>
    </main>
  );
}
