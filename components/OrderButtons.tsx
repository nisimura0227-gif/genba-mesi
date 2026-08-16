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
  orderingPaused,
}: {
  cutoffAtMs: number;
  serverNowMs: number;
  /** 休工モード。trueの間は今日・明日どちらのボタンも停止表示にする */
  orderingPaused?: boolean;
}) {
  const { closed } = useCountdown(cutoffAtMs, serverNowMs);

  if (orderingPaused) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-[84px] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl bg-gray-200 px-6 py-5 text-center text-gray-500"
      >
        <span className="text-lg font-bold">🚧 本日は注文を受け付けていません</span>
        <span className="text-xs">休工などのため、注文受付を一時停止しています</span>
      </div>
    );
  }

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
