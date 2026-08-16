"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "注文", icon: "📋" },
  { href: "/admin/history", label: "履歴", icon: "🗂" },
  { href: "/admin/menu", label: "メニュー", icon: "🍱" },
  { href: "/admin/names", label: "名前", icon: "👤" },
  { href: "/admin/image", label: "画像", icon: "🖼" },
  { href: "/admin/settings", label: "設定", icon: "⚙️" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto flex w-full max-w-md items-stretch border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
              active ? "font-bold text-brand-dark" : "text-gray-400"
            )}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
