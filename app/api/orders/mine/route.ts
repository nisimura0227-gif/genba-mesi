import { NextRequest, NextResponse } from "next/server";
import { findOrder, getSettings, orderTotal, deleteOrder } from "@/lib/store";
import { todayStr, tomorrowStr, isTodayOrderClosed } from "@/lib/date";

export const runtime = "nodejs";

/**
 * 自分の注文状況を取得する（誰でも利用可）。
 * 名前で1件だけ引くので、他人の一覧が漏れることはない。
 * 例) /api/orders/mine?name=山田太郎&via=today
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const via = req.nextUrl.searchParams.get("via") === "tomorrow" ? "tomorrow" : "today";

  if (!name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  const settings = await getSettings();
  const deliveryDate = via === "today" ? todayStr() : tomorrowStr();
  const order = await findOrder(deliveryDate, name);
  const cutoffHour = via === "today" ? settings.cutoffHour : settings.tomorrowCutoffHour;
  const cutoffMinute = via === "today" ? settings.cutoffMinute : settings.tomorrowCutoffMinute;
  const closed = isTodayOrderClosed(cutoffHour, cutoffMinute);

  return NextResponse.json({
    order: order
      ? {
          menuItem: order.menuItem,
          isLarge: order.isLarge,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          total: orderTotal(order),
          orderedAt: order.orderedAt,
        }
      : null,
    closed,
  });
}

/**
 * 自分の注文をキャンセルする（誰でも利用可・締切前のみ）。
 * 支払いを「申告」または「確認」済みの注文は、本人操作だけで記録が消えて
 * 現金と注文の記録が食い違う事故を防ぐため、自己キャンセルできない
 * （担当者が管理画面から対応する）。
 * 例) DELETE /api/orders/mine?name=山田太郎&via=today
 */
export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const via = req.nextUrl.searchParams.get("via") === "tomorrow" ? "tomorrow" : "today";

  if (!name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  const settings = await getSettings();
  const deliveryDate = via === "today" ? todayStr() : tomorrowStr();
  const cutoffHour = via === "today" ? settings.cutoffHour : settings.tomorrowCutoffHour;
  const cutoffMinute = via === "today" ? settings.cutoffMinute : settings.tomorrowCutoffMinute;

  const order = await findOrder(deliveryDate, name);
  if (!order) {
    return NextResponse.json({ message: "対象の注文が見つかりません。" }, { status: 404 });
  }

  if (order.paymentStatus !== "unpaid") {
    return NextResponse.json(
      {
        message:
          "支払い済み、または支払い確認中のため、この注文はご自身ではキャンセルできません。変更・キャンセルが必要な場合は担当者へご連絡ください。",
      },
      { status: 409 }
    );
  }

  if (isTodayOrderClosed(cutoffHour, cutoffMinute)) {
    return NextResponse.json({ message: "受付時間を過ぎたため、キャンセルできません。" }, { status: 403 });
  }

  await deleteOrder(order.id);
  return NextResponse.json({ ok: true });
}
