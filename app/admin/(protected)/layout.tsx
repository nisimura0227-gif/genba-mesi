import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";
import AdminNav from "@/components/AdminNav";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!isValidSessionToken(token)) {
    redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas pb-24">
      <header className="flex items-center justify-between bg-white px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" width={30} height={30} className="rounded-lg" />
          <h1 className="text-base font-bold text-brand-dark">現場めし 管理画面</h1>
        </div>
        <LogoutButton />
      </header>
      <div className="flex-1 px-4 py-5">{children}</div>
      <AdminNav />
    </main>
  );
}
