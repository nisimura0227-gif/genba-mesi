// 業務レベルのLINE通知の組み立て。
// すべて try/catch でラップしてあり、LINE送信が失敗しても
// 注文・支払い処理そのものは絶対に失敗させない（呼び出し側は await せず発火のみでもよい）。

import type { Order } from "./storeTypes";
import { orderTotal, paymentStatusLabel } from "./storeTypes";
import { getSettings, getLineLinkByName, listLineLinks } from "./store";
import { formatDateJp, formatTimeHm } from "./date";
import { pushMessage, multicastMessage, type LineMessage } from "./line";

function yen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

function liffOrderUrl(path: "today" | "tomorrow"): string | null {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) return `https://liff.line.me/${liffId}/order/${path}`;
  const base = siteUrl();
  return base ? `${base}/order/${path}` : null;
}

async function safeRun(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[notify] ${label} failed:`, err);
  }
}

/** ①新しい注文が入ったとき（変更時も同様のイベントとして呼ぶ） */
export async function notifyAdminNewOrder(order: Order, isEdit: boolean, amountChanged: boolean): Promise<void> {
  await safeRun("notifyAdminNewOrder", async () => {
    const settings = await getSettings();
    if (settings.adminLineUsers.length === 0) return;

    const label = order.orderedVia === "today" ? "今日" : "明日";
    const heading = isEdit ? `✏️ ${label}の注文が変更されました` : `🍱 ${label}の新しい注文が入りました`;
    const lines = [
      heading,
      "",
      `👤 ${order.name}`,
      `🍱 ${order.menuItem}${order.isLarge ? "（大盛り）" : ""}`,
      `💰 ${yen(orderTotal(order))}`,
      `💴 支払い状況：${paymentStatusLabel(order.paymentStatus)}`,
    ];
    if (isEdit && amountChanged && order.paymentStatus !== "unpaid") {
      lines.push("", "⚠️ 金額が変わりました。支払い状況は引き継がれています。念のためご確認ください。");
    }
    const messages: LineMessage[] = [{ type: "text", text: lines.join("\n") }];
    await multicastMessage(
      settings.adminLineUsers.map((u) => u.lineUserId),
      messages
    );
  });
}

/** 本人が「支払いました」と申告したとき：管理者へ受け取り確認ボタン付きで通知 */
export async function notifyAdminPaymentClaimed(order: Order): Promise<void> {
  await safeRun("notifyAdminPaymentClaimed", async () => {
    const settings = await getSettings();
    if (settings.adminLineUsers.length === 0) return;

    const label = order.orderedVia === "today" ? "今日" : "明日";
    const messages: LineMessage[] = [
      {
        type: "flex",
        altText: `🙋 ${order.name}さんが支払いを申告しました`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              { type: "text", text: "🙋 支払い申告", weight: "bold", size: "lg", color: "#B45309" },
              { type: "text", text: `${label}の注文（${order.name}さん）`, size: "sm", color: "#666666" },
              { type: "separator", margin: "md" },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "xs",
                contents: [
                  { type: "text", text: `👤 ${order.name}` },
                  { type: "text", text: `🍱 ${order.menuItem}${order.isLarge ? "（大盛り）" : ""}` },
                  { type: "text", text: `💰 ${yen(orderTotal(order))}` },
                ],
              },
              { type: "text", text: "現金を実際に受け取ってから押してください。", size: "xs", color: "#999999", wrap: true, margin: "md" },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#2f7d4f",
                action: {
                  type: "postback",
                  label: "✅ 受け取り確認",
                  data: `action=confirmPaid&orderId=${order.id}`,
                  displayText: `${order.name}さんの受け取りを確認しました`,
                },
              },
            ],
          },
        },
      },
    ];
    await multicastMessage(
      settings.adminLineUsers.map((u) => u.lineUserId),
      messages
    );
  });
}

/** ②注文完了通知（注文者本人へ） */
export async function notifyUserOrderConfirmed(order: Order): Promise<void> {
  await safeRun("notifyUserOrderConfirmed", async () => {
    const link = await getLineLinkByName(order.name);
    if (!link) return;
    const label = order.orderedVia === "today" ? "今日" : "明日";
    const lines = [
      `✅ ${label}のお弁当注文を受け付けました`,
      "",
      `🍱 ${order.menuItem}${order.isLarge ? "（大盛り）" : ""}`,
      `💰 ${yen(orderTotal(order))}`,
      `💴 支払い方法：${order.paymentMethod}`,
      `📅 注文日：${formatDateJp(order.deliveryDate)}分（${formatTimeHm(new Date(order.orderedAt))}注文）`,
    ];
    await pushMessage(link.lineUserId, [{ type: "text", text: lines.join("\n") }]);
  });
}

/** ③支払い確認通知（管理者が受け取り確認した後、注文者本人へ） */
export async function notifyUserPaymentConfirmed(order: Order): Promise<void> {
  await safeRun("notifyUserPaymentConfirmed", async () => {
    const link = await getLineLinkByName(order.name);
    if (!link) return;
    const text = `✅ お支払いを確認しました。ありがとうございました！\n\n🍱 ${order.menuItem}${order.isLarge ? "（大盛り）" : ""}\n💰 ${yen(orderTotal(order))}`;
    await pushMessage(link.lineUserId, [{ type: "text", text }]);
  });
}

/** ④管理者が注文を削除したとき（注文者本人へ） */
export async function notifyUserOrderDeleted(order: Order): Promise<void> {
  await safeRun("notifyUserOrderDeleted", async () => {
    const link = await getLineLinkByName(order.name);
    if (!link) return;
    const label = order.orderedVia === "today" ? "今日" : "明日";
    const lines = [
      `🗑️ ${label}の注文が担当者により削除されました`,
      "",
      `🍱 ${order.menuItem}${order.isLarge ? "（大盛り）" : ""}`,
      `💰 ${yen(orderTotal(order))}`,
      "",
      "心当たりがない場合や、注文が必要な場合は担当者へご連絡ください。",
    ];
    await pushMessage(link.lineUserId, [{ type: "text", text: lines.join("\n") }]);
  });
}

/** 毎朝6:30のリマインド（全利用者へ） */
export async function notifyMorningReminder(cutoffLabel: string): Promise<void> {
  await safeRun("notifyMorningReminder", async () => {
    const links = await listLineLinks();
    if (links.length === 0) return;
    const url = liffOrderUrl("today");
    const contents: Record<string, unknown> = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "🍱 おはようございます！", weight: "bold", size: "lg" },
          { type: "text", text: "本日のお弁当受付中です。", wrap: true },
          { type: "text", text: `締切は${cutoffLabel}です。`, wrap: true, color: "#B45309", weight: "bold" },
        ],
      },
      ...(url
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#2f7d4f",
                  action: { type: "uri", label: "🍱 注文する", uri: url },
                },
              ],
            },
          }
        : {}),
    };
    await multicastMessage(
      links.map((l) => l.lineUserId),
      [{ type: "flex", altText: `おはようございます！本日のお弁当受付中です。締切は${cutoffLabel}です。`, contents }]
    );
  });
}

/** 前日15:00・明日注文の受付終了サマリー（管理者へ） */
export async function notifyTomorrowCutoffSummary(params: {
  count: number;
  menuBreakdown: { menuItem: string; count: number }[];
  totalAmount: number;
  paidCount: number;
  unpaidCount: number;
  claimedCount: number;
}): Promise<void> {
  await safeRun("notifyTomorrowCutoffSummary", async () => {
    const settings = await getSettings();
    const adminIds = settings.adminLineUsers.map((u) => u.lineUserId);
    if (adminIds.length === 0) return;
    const { count, menuBreakdown, totalAmount, paidCount, unpaidCount, claimedCount } = params;

    if (count === 0) {
      await multicastMessage(adminIds, [
        { type: "text", text: "📅 明日の注文の受付を終了しました。\n注文はありませんでした。" },
      ]);
      return;
    }

    const lines = [
      "📅 明日の注文の受付を終了しました",
      "",
      `👥 注文人数：${count}人`,
      ...menuBreakdown.map((m) => `　・${m.menuItem}：${m.count}個`),
      `💰 合計金額：${yen(totalAmount)}`,
      "",
      `✅ 支払い済み：${paidCount}人`,
      `🙋 申告済み（確認待ち）：${claimedCount}人`,
      `⏳ 未払い：${unpaidCount}人`,
    ];
    if (unpaidCount > 0 || claimedCount > 0) {
      lines.push("", "⚠️ 未確認の支払いがあります。前日中に確認をお願いします。");
    }
    await multicastMessage(adminIds, [{ type: "text", text: lines.join("\n") }]);
  });
}
