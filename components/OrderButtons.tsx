"use client";

import Link from "next/link";
import { useCountdown } from "./useCountdown";

function PausedBlock({ text }: { text: string }) {
  return (
    <div
      aria-disabled="true"
      className="flex min-h-[84px] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl bg-gray-200 px-6 py-5 text-center text-gray-500"
    >
      <span className="text-lg font-bold">🚧 {text}</span>
      <span className="text-xs">休工などのため、注文受付を停止しています</span>
    </div>
  );
}

/**
 * トップページの注文ボタン。
 * 今日ボタンは締切を過ぎると押せなくなる（画面を開いたまま締切を迎えてもその場で無効化）。
 * 今日・明日はそれぞれ独立して休工（土日の自動休工／管理者の手動休工）になりうるため、
 * 2つのボタンを個別に停止表示できるようにしている。
 */
export default function OrderButtons({
  cutoffAtMs,
  serverNowMs,
  todayPaused,
  tomorrowPaused,
}: {
  cutoffAtMs: number;
  serverNowMs: number;
  todayPaused?: boolean;
  tomorrowPaused?: boolean;
}) {
  const { closed } = useCountdown(cutoffAtMs, serverNowMs);

  return (
    <div className="flex flex-col gap-3">
      {todayPaused ? (
        <PausedBlock text="本日は注文を受け付けていません" />
      ) : closed ? (
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

      {tomorrowPaused ? (
        <PausedBlock text="明日は注文を受け付けていません" />
      ) : (
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
      )}
    </div>
  );
}
