import Link from "next/link";
import { listNames, listMenuItems, getSettings } from "@/lib/store";
import { todayStr, formatDateJp, formatCutoffLabel, cutoffEpochMs } from "@/lib/date";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function TodayOrderPage() {
  const [names, menuItems, settings] = await Promise.all([listNames(), listMenuItems(), getSettings()]);

  const now = new Date();
  const dateLabel = formatDateJp(todayStr(now));
  const cutoffLabel = formatCutoffLabel(settings.cutoffHour, settings.cutoffMinute);
  const cutoffAtMs = cutoffEpochMs(settings.cutoffHour, settings.cutoffMinute, now);

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
          <h1 className="text-lg font-bold text-brand-dark">🍱 今日のお弁当注文</h1>
          <p className="text-xs text-gray-500">
            {dateLabel}分・受付は {cutoffLabel} まで
          </p>
        </div>
      </header>

      {settings.orderingPaused ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-4xl">🚧</p>
          <p className="text-lg font-bold text-gray-700">本日は注文を受け付けていません</p>
          <p className="text-sm text-gray-500">休工などのため、注文受付を一時停止しています。</p>
        </div>
      ) : menuItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-gray-500">
          <p>メニューが登録されていません。</p>
          <p className="text-sm">管理者に登録を依頼してください。</p>
        </div>
      ) : (
        <OrderForm
          orderedVia="today"
          names={names}
          menuItems={menuItems}
          largeExtraPrice={settings.largeExtraPrice}
          cutoffAtMs={cutoffAtMs}
          serverNowMs={now.getTime()}
          cutoffNotice={`⏰ 受付は${cutoffLabel}までです。\n💴 支払いは「手渡し」です。締切までに担当者へお支払いください。`}
          adminName={settings.adminName}
          cutoffLabel={cutoffLabel}
        />
      )}
    </main>
  );
}
