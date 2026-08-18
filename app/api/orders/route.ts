import { NextRequest, NextResponse } from "next/server";
import { listOrdersByDate, listMenuItems, upsertOrder, addName, getSettings, orderTotal, PAYMENT_METHOD } from "@/lib/store";
import { isAdminRequest } from "@/lib/authGuard";
import { isTodayOrderClosed, todayStr, tomorrowStr, formatCutoffLabel, isOrderingPausedForDate } from "@/lib/date";
import { notifyAdminNewOrder, notifyUserOrderConfirmed } from "@/lib/notify";

export const runtime = "nodejs";

// 管理画面から特定日の注文一覧を取得
export async function GET(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ message: "権限がありません。" }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }
  const orders = await listOrdersByDate(date);
  return NextResponse.json({ orders });
}

// 注文フォームからの注文登録・変更（誰でも利用可）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderedVia = body?.orderedVia === "tomorrow" ? "tomorrow" : "today";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const menuItem = typeof body?.menuItem === "string" ? body.menuItem.trim() : "";
  const isLarge = body?.isLarge === true;
  // true のときだけ、同じ名前・同じ日付の既存注文を上書きしてよい。
  // 同姓同名の別人の注文を静かに上書きしてしまう事故を防ぐためのガード。
  const confirmOverwrite = body?.confirmOverwrite === true;
  // 支払い方法は「手渡し」固定（現金ケースへの投函は廃止）。クライアント入力は信用しない。
  const paymentMethod = PAYMENT_METHOD;

  if (!name || !menuItem) {
    return NextResponse.json({ message: "名前とメニューを選択してください。" }, { status: 400 });
  }
  if (name.length > 20) {
    return NextResponse.json({ message: "名前は20文字以内で入力してください。" }, { status: 400 });
  }
  if (company.length > 30) {
    return NextResponse.json({ message: "所属会社は30文字以内で入力してください。" }, { status: 400 });
  }

  const settings = await getSettings();
  const expectedDate = orderedVia === "today" ? todayStr() : tomorrowStr();

  if (isOrderingPausedForDate(settings, expectedDate)) {
    return NextResponse.json({ message: "本日は注文を受け付けていません。" }, { status: 403 });
  }

  if (orderedVia === "today") {
    if (isTodayOrderClosed(settings.cutoffHour, settings.cutoffMinute)) {
      const label = formatCutoffLabel(settings.cutoffHour, settings.cutoffMinute);
      return NextResponse.json({ message: `本日の受付は終了しました。（受付は${label}まで）` }, { status: 403 });
    }
  } else {
    // 明日の注文は「本日」の指定時刻（前日締切）まで
    if (isTodayOrderClosed(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute)) {
      const label = formatCutoffLabel(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute);
      return NextResponse.json({ message: `明日の受付は終了しました。（受付は本日${label}まで）` }, { status: 403 });
    }
  }

  // 注文時点の金額を記録しておく（後でメニューの金額を変えても過去の注文がずれないように）
  const menu = await listMenuItems();
  const selected = menu.find((m) => m.name === menuItem);
  if (!selected) {
    return NextResponse.json({ message: "選択されたメニューが見つかりません。" }, { status: 400 });
  }
  const unitPrice = selected.price;
  const largeExtra = isLarge ? settings.largeExtraPrice : 0;

  const result = await upsertOrder({
    deliveryDate: expectedDate,
    orderedVia,
    name,
    company,
    menuItem,
    isLarge,
    unitPrice,
    largeExtra,
    paymentMethod,
    confirmOverwrite,
  });

  if (!result.ok) {
    // 同じ名前・同じ日付の注文が既にある。別人の可能性があるため、
    // 確認なしには上書きせず、既存注文の内容を返して確認を求める。
    const existing = result.existing;
    return NextResponse.json(
      {
        conflict: true,
        message: `「${name}」さんの注文はすでにあります。`,
        existing: {
          menuItem: existing.menuItem,
          isLarge: existing.isLarge,
          total: orderTotal(existing),
        },
      },
      { status: 409 }
    );
  }

  const { order, isEdit, previous } = result;
  const amountChanged = previous ? previous.unitPrice + previous.largeExtra !== unitPrice + largeExtra : false;

  // 名前は自己登録できる。既に同名があれば addName 内で重複登録されない。
  await addName(name);

  if (settings.notifyNewOrder) {
    notifyAdminNewOrder(order, isEdit, amountChanged).catch(() => {});
  }
  notifyUserOrderConfirmed(order).catch(() => {});

  return NextResponse.json({ order });
}
