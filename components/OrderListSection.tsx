"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, PaymentStatus } from "@/lib/storeTypes";
import { orderTotal, paymentStatusLabel, orderDisplayName } from "@/lib/storeTypes";
import { formatTimeHm } from "@/lib/date";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import Button from "./ui/Button";

function yen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

/**
 * 管理画面の注文一覧。
 * 支払い状況は管理者のみが操作でき、押した時点で保存される。
 * 実際に現金を受け取って確認した状態だけが「支払い済み」になる
 * （本人の「渡しました」申告だけでは支払い済みにしない）。
 */
export default function OrderListSection({
  title,
  dateLabel,
  orders,
  showPayment,
}: {
  title: string;
  dateLabel: string;
  orders: Order[];
  showPayment: boolean;
}) {
  const router = useRouter();
  // 保存の往復を待たずに画面へ反映するための一時的な状態
  const [pending, setPending] = useState<Record<string, PaymentStatus>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const statusOf = (o: Order): PaymentStatus => pending[o.id] ?? o.paymentStatus;

  async function setStatus(order: Order, next: PaymentStatus) {
    const prev = statusOf(order);
    if (prev === next) return;
    setPending((p) => ({ ...p, [order.id]: next }));
    setBusyId(order.id);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      // 失敗したら元の状態へ戻す
      setPending((p) => ({ ...p, [order.id]: prev }));
      setError("支払い状況の更新に失敗しました。通信環境を確認してください。");
    } finally {
      setBusyId(null);
    }
  }

  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.menuItem, (counts.get(o.menuItem) ?? 0) + 1);
  const totalAmount = orders.reduce((sum, o) => sum + orderTotal(o), 0);
  const unpaidCount = orders.filter((o) => statusOf(o) !== "paid").length;

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-base font-bold text-brand-dark">{title}</h2>
      <p className="mb-3 text-xs text-gray-500">{dateLabel}</p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-gray-400">まだ注文はありません。</Card>
      ) : (
        <>
          <Card className="mb-4 divide-y divide-gray-100 p-0">
            {orders.map((o) => {
              const status = statusOf(o);
              const busy = busyId === o.id;
              return (
                <div key={o.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800">{orderDisplayName(o)}</p>
                      <p className="text-sm text-gray-500">
                        {o.menuItem}
                        {o.isLarge ? "（大盛り）" : ""}
                      </p>
                      {showPayment && <p className="text-sm text-gray-500">{o.paymentMethod}</p>}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-gray-700">{yen(orderTotal(o))}</span>
                      <span className="text-xs text-gray-400">{formatTimeHm(new Date(o.orderedAt))}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <Badge variant={status === "paid" ? "success" : status === "claimed" ? "warning" : "neutral"}>
                      {status === "paid" ? "✅" : status === "claimed" ? "🙋" : "⏳"} {paymentStatusLabel(status)}
                    </Badge>

                    {status === "paid" ? (
                      <Button type="button" size="sm" variant="muted" disabled={busy} onClick={() => setStatus(o, "unpaid")}>
                        取り消す
                      </Button>
                    ) : status === "claimed" ? (
                      <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => setStatus(o, "paid")}>
                        受け取り確認
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setStatus(o, "paid")}>
                        支払い済みにする
                      </Button>
                    )}
                  </div>

                  {(o.paymentClaimedAt || o.paymentConfirmedAt) && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      {o.paymentClaimedAt && <>申告 {formatTimeHm(new Date(o.paymentClaimedAt))}　</>}
                      {o.paymentConfirmedAt && <>確認 {formatTimeHm(new Date(o.paymentConfirmedAt))}</>}
                    </p>
                  )}
                </div>
              );
            })}
          </Card>

          <Card className="bg-brand-light">
            <p className="mb-1 text-xs font-bold text-brand-dark">自動集計</p>
            <ul className="text-sm text-gray-700">
              {Array.from(counts.entries()).map(([menuItem, count]) => (
                <li key={menuItem} className="flex justify-between">
                  <span>{menuItem}</span>
                  <span>{count}個</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-brand/30 pt-2 text-sm font-bold text-brand-dark">
              <span>合計</span>
              <span>
                {orders.length}個 / {yen(totalAmount)}
              </span>
            </div>
            {unpaidCount > 0 && (
              <div className="mt-2 flex justify-end">
                <Badge variant="warning">支払い未確認 {unpaidCount}人</Badge>
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
