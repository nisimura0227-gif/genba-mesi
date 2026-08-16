"use client";

import { useCountdown } from "./useCountdown";
import { Card } from "./ui/Card";

/**
 * トップページの情報カード。
 * 「受付終了まで」は1分ごとに自動更新され、締切を過ぎると受付終了の表示に切り替わる。
 */
export default function StatusCard({
  dateLabel,
  adminName,
  cutoffLabel,
  cutoffAtMs,
  serverNowMs,
  orderingPaused,
}: {
  dateLabel: string;
  adminName: string;
  cutoffLabel: string;
  cutoffAtMs: number;
  serverNowMs: number;
  /** 休工モード。trueの間は締切カウントダウンの代わりに停止中の表示にする */
  orderingPaused?: boolean;
}) {
  const { closed, hours, minutes } = useCountdown(cutoffAtMs, serverNowMs);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">本日</p>
          <p className="text-base font-bold text-ink">📅 {dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">担当</p>
          <p className="text-base font-bold text-ink">👷 {adminName}</p>
        </div>
      </div>

      {orderingPaused ? (
        <div className="flex items-center justify-center gap-2 bg-gray-100 px-5 py-4">
          <span className="text-sm font-extrabold text-gray-500">🚧 本日は注文受付を停止しています</span>
        </div>
      ) : closed ? (
        <div className="flex items-center justify-center gap-2 bg-red-50 px-5 py-4">
          <span className="text-sm font-extrabold text-red-600">🔴 本日の受付は終了しました</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-brand-light px-5 py-4">
            <span className="text-sm font-bold text-brand-dark">⏰ 受付終了まで</span>
            <span className="text-2xl font-extrabold text-brand-darker">
              あと{hours > 0 ? `${hours}時間` : ""}
              {minutes}分
            </span>
          </div>
          <p className="px-5 pb-3 pt-2 text-right text-xs text-gray-400">受付は {cutoffLabel} まで</p>
        </>
      )}
    </Card>
  );
}
