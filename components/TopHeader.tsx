import Link from "next/link";

/** トップページ上部のブランドヘッダー。 */
export default function TopHeader() {
  return (
    <header className="flex items-center justify-between bg-brand-gradient px-4 py-4 text-white shadow-card">
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="" width={38} height={38} className="rounded-xl bg-white/15 p-1" />
        <div>
          <h1 className="text-lg font-extrabold leading-tight tracking-tight">現場めし</h1>
          <p className="text-[11px] font-medium text-white/70">お弁当注文サイト</p>
        </div>
      </div>
      <Link
        href="/admin/login"
        className="rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition-colors active:bg-white/25"
      >
        管理者
      </Link>
    </header>
  );
}
