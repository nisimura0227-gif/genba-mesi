"use client";

import Link from "next/link";
import { useCountdown } from "./useCountdown";

/**
 * トップページの注文ボタン。
 * 締切を過ぎると「今日のお弁当を注文する」を押せなくする。
 * 画面を開いたまま締切を迎えた場合もその場で無効化される。
 */
export default function OrderButtons({
  cutoffAtMs,
  serverNowMs,
}: {
  cutoffAtMs: number;
  serverNowMs: number;
}) {
  const { closed } = useCountdown(cutoffAtMs, serverNowMs);

  return (
    <div className="flex flex-col gap-3">
      {closed ? (
        <div
          aria-disabled="true"
          className="flex min-h-[84px] cursor-not-allowed items-center justify-center rounded-2xl bg-gray-200 px-6 py-5 text-center text-lg font-bold text-gray-500"
        >
          🔴 本日の受付は終了しました
        </div>
      ) : (
        <Link
          href="/order/today"
          className="flex min-h-[84px] items-center justify-between rounded-2xl bg-brand-gradient px-6 py-5 text-white shadow-pop transition-all active:translate-y-px active:scale-[0.99] active:shadow-none"
        >
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Today</span>
            <span className="text-xl font-extrabold">🍱 今日のお弁当</span>
          </span>
          <span className="text-2xl text-white/80">›</span>
        </Link>
      )}

      <Link
        href="/order/tomorrow"
        className="flex min-h-[84px] items-center justify-between rounded-2xl bg-accent-gradient px-6 py-5 text-white shadow-pop transition-all active:translate-y-px active:scale-[0.99] active:shadow-none"
      >
        <span className="flex flex-col items-start gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Tomorrow</span>
          <span className="text-xl font-extrabold">📅 明日のお弁当</span>
        </span>
        <span className="text-2xl text-white/80">›</span>
      </Link>
    </div>
  );
}
