// LINE Messaging API の薄いラッパー。
// 環境変数（LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET）が未設定の場合は
// 何も送信せず警告ログのみ出す。LINE未設定でもサイト本体の注文機能は
// 一切壊れないようにするための設計。

import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://api.line.me/v2/bot";

export type LineMessage =
  | { type: "text"; text: string }
  | { type: "flex"; altText: string; contents: Record<string, unknown> };

function getAccessToken(): string | null {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || null;
}

function getChannelSecret(): string | null {
  return process.env.LINE_CHANNEL_SECRET || null;
}

async function callApi(path: string, body: unknown): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    console.warn(`[line] LINE_CHANNEL_ACCESS_TOKEN未設定のため送信をスキップしました（${path}）`);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[line] APIエラー ${path}: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error(`[line] 送信失敗 ${path}:`, err);
  }
}

/** 特定の1人へ送信する */
export async function pushMessage(to: string, messages: LineMessage[]): Promise<void> {
  if (!to || messages.length === 0) return;
  await callApi("/message/push", { to, messages });
}

/** 複数人へまとめて送信する（最大500人/回。今回の規模なら1回で十分） */
export async function multicastMessage(to: string[], messages: LineMessage[]): Promise<void> {
  const targets = Array.from(new Set(to.filter(Boolean)));
  if (targets.length === 0 || messages.length === 0) return;
  for (let i = 0; i < targets.length; i += 500) {
    await callApi("/message/multicast", { to: targets.slice(i, i + 500), messages });
  }
}

/** Webhookイベントへの応答（replyTokenは1回しか使えない） */
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
  if (!replyToken || messages.length === 0) return;
  await callApi("/message/reply", { replyToken, messages });
}

/** Webhookの署名検証（x-line-signature）。生ボディをそのまま渡すこと。 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = getChannelSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
