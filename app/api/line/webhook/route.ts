import { NextRequest, NextResponse } from "next/server";
import { getSettings, getOrderById, setOrderPaymentStatus } from "@/lib/store";
import { verifySignature, replyMessage } from "@/lib/line";
import { notifyUserPaymentConfirmed } from "@/lib/notify";

export const runtime = "nodejs";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  postback?: { data: string };
};

/**
 * 管理者がLINE上で「✅ 受け取り確認」ボタンを押したときのpostbackを受け取る。
 * 送信者が settings.adminLineUsers に登録された管理者かどうかを必ず
 * サーバー側で再検証してから支払い状況を確定する（なりすまし対策）。
 */
async function handlePostback(event: LineEvent): Promise<void> {
  const userId = event.source?.userId;
  const data = event.postback?.data ?? "";
  if (!userId || !data) return;

  const params = new URLSearchParams(data);
  const action = params.get("action");
  const orderId = params.get("orderId");
  if (action !== "confirmPaid" || !orderId) return;

  const settings = await getSettings();
  if (!settings.adminLineUsers.some((u) => u.lineUserId === userId)) {
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "この操作は管理者として登録されたLINEアカウントのみ行えます。" },
      ]);
    }
    return;
  }

  // 複数の管理者がほぼ同時に「受け取り確認」を押した場合に、本人へのLINE通知が
  // 二重に届かないよう、確定前に現在の状態を見て既にpaidなら通知をスキップする。
  const before = await getOrderById(orderId);
  if (!before) {
    if (event.replyToken) {
      await replyMessage(event.replyToken, [{ type: "text", text: "対象の注文が見つかりませんでした。" }]);
    }
    return;
  }
  const alreadyPaid = before.paymentStatus === "paid";

  const order = await setOrderPaymentStatus(orderId, "paid", { confirmedBy: userId });
  if (!order) {
    if (event.replyToken) {
      await replyMessage(event.replyToken, [{ type: "text", text: "対象の注文が見つかりませんでした。" }]);
    }
    return;
  }

  if (!alreadyPaid) {
    notifyUserPaymentConfirmed(order).catch(() => {});
  }

  if (event.replyToken) {
    const text = alreadyPaid
      ? `${order.name}さんはすでに支払い済みです（他の管理者が確認済みです）。`
      : `✅ ${order.name}さんの支払いを「支払い済み」にしました。`;
    await replyMessage(event.replyToken, [{ type: "text", text }]);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ message: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };
  const events = body.events ?? [];

  for (const event of events) {
    if (event.type === "postback") {
      await handlePostback(event).catch((err) => console.error("[line webhook] postback failed:", err));
    }
    // follow / message などその他のイベントは今回は何もしない
    // （利用者の紐付けはLIFF経由で行うため）。
  }

  return NextResponse.json({ ok: true });
}
