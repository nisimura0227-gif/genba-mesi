import Link from "next/link";
import { listNames, listMenuItems, getSettings } from "@/lib/store";
import { tomorrowStr, formatDateJp, formatCutoffLabel, cutoffEpochMs } from "@/lib/date";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function TomorrowOrderPage() {
  const [names, menuItems, settings] = await Promise.all([listNames(), listMenuItems(), getSettings()]);

  const now = new Date();
  const dateLabel = formatDateJp(tomorrowStr(now));
  // 明日の注文の締切は「今日の」指定時刻（前日締切）。
  const cutoffLabel = formatCutoffLabel(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute);
  const cutoffAtMs = cutoffEpochMs(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute, now);

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-4">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm active:bg-gray-100"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-dark">📅 明日のお弁当注文</h1>
          <p className="text-xs text-gray-500">
            {dateLabel}分・受付は本日{cutoffLabel} まで
          </p>
        </div>
      </header>

      {menuItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-gray-500">
          <p>メニューが登録されていません。</p>
          <p className="text-sm">管理者に登録を依頼してください。</p>
        </div>
      ) : (
        <OrderForm
          orderedVia="tomorrow"
          names={names}
          menuItems={menuItems}
          largeExtraPrice={settings.largeExtraPrice}
          cutoffAtMs={cutoffAtMs}
          serverNowMs={now.getTime()}
          cutoffNotice={`⏰ 受付は本日${cutoffLabel}までです。\n💴 支払いは「手渡し」です。本日中に担当者へお支払いください（当日朝の集金はありません）。`}
        />
      )}
    </main>
  );
}
