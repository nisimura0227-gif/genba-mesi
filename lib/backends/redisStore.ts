// 本番（Vercelなどのサーバーレス環境）向けのRedisバックエンド。
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されているときに使われる。
//
// 名前・メニュー・注文・設定はJSONとしてそのままキーに保存し、
// 画像はBase64文字列として同じRedisに保存する（Vercelの関数から
// ファイルシステムへ書き込んでも永続化されないため）。

import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import type {
  NameItem,
  MenuItem,
  Order,
  ImageInfo,
  UpsertOrderInput,
  UpsertOrderResult,
  Settings,
  StoreBackend,
  PaymentStatus,
  LineLink,
} from "../storeTypes";
import { IMAGE_MIME, normalizeSettings } from "../storeTypes";

const NAMES_KEY = "bento:names";
const MENU_KEY = "bento:menu";
const ORDERS_KEY = "bento:orders";
const IMAGE_META_KEY = "bento:image:meta";
const IMAGE_DATA_KEY = "bento:image:data";
const SETTINGS_KEY = "bento:settings";
const LINE_LINKS_KEY = "bento:lineLinks";

let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    // Vercel経由でUpstash連携すると環境変数名が KV_REST_API_* になっている
    // 場合があるため、両方のパターンに対応しておく。
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
    client = new Redis({ url, token });
  }
  return client;
}

// Upstash Redis SDKは、保存された値が有効なJSONならSDK側で自動的にパースして返す。
// そのため JSON.stringify した文字列（例: "abc"）は、読み出し時にはすでに
// 素の文字列 abc へ戻っている。これをもう一度 JSON.parse すると失敗するため、
// パースに失敗した場合は「すでに目的の値になっている」とみなしてそのまま返す。
// （この二重パースが原因で、担当者名と画像データが保存できなくなっていた）
async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await redis().get(key);
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }
  return raw as T;
}

async function setJson<T>(key: string, value: T): Promise<void> {
  await redis().set(key, JSON.stringify(value));
}

/**
 * Redis上の簡易ロック。fileStore.ts の withLock（同一プロセス内での直列化）と異なり、
 * Vercelのサーバーレス関数は毎回別プロセスで動くため、Redis自体に「読み取り→書き込み」の
 * 区間をロックしないと、同時刻に複数人が注文したときに片方の注文が消えてしまう
 * （後勝ちで上書きされる）。SET NX（未設定のときだけ成功）で簡易的な排他制御を行う。
 */
async function withLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `bento:lock:${lockName}`;
  const token = randomUUID();
  const maxWaitMs = 4000;
  const start = Date.now();
  let acquired = false;
  while (Date.now() - start < maxWaitMs) {
    const result = await redis().set(lockKey, token, { nx: true, px: 3000 });
    if (result === "OK") {
      acquired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
  }
  // ロックが取れなくても処理自体は続行する（ロック取得の失敗で注文を失敗させないため）。
  // 取れなかった場合は最後に書いた方が勝つ従来通りの挙動に留まる。
  try {
    return await fn();
  } finally {
    if (acquired) {
      const current = await redis().get(lockKey);
      if (current === token) await redis().del(lockKey);
    }
  }
}

/* ---------------- 名前 ---------------- */

async function listNames(): Promise<NameItem[]> {
  return getJson<NameItem[]>(NAMES_KEY, []);
}

async function addName(name: string): Promise<NameItem> {
  return withLock("names", async () => {
    const list = await getJson<NameItem[]>(NAMES_KEY, []);
    const trimmed = name.trim();
    const existing = list.find((n) => n.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const item: NameItem = { id: randomUUID(), name: trimmed, createdAt: new Date().toISOString() };
    list.push(item);
    await setJson(NAMES_KEY, list);
    return item;
  });
}

async function updateNameItem(id: string, name: string): Promise<NameItem | null> {
  return withLock("names", async () => {
    const list = await getJson<NameItem[]>(NAMES_KEY, []);
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], name: name.trim() };
    await setJson(NAMES_KEY, list);
    return list[idx];
  });
}

async function deleteNameItem(id: string): Promise<void> {
  return withLock("names", async () => {
    const list = await getJson<NameItem[]>(NAMES_KEY, []);
    await setJson(
      NAMES_KEY,
      list.filter((n) => n.id !== id)
    );
  });
}

/* ---------------- メニュー ---------------- */

async function listMenuItems(): Promise<MenuItem[]> {
  const list = await getJson<MenuItem[]>(MENU_KEY, []);
  // 金額項目を追加する前に登録されたメニューには price が無いため補正する。
  return list.map((m) => ({ ...m, price: Number.isFinite(m.price) ? m.price : 0 }));
}

async function addMenuItem(name: string, price: number): Promise<MenuItem> {
  return withLock("menu", async () => {
    const list = await getJson<MenuItem[]>(MENU_KEY, []);
    const item: MenuItem = {
      id: randomUUID(),
      name: name.trim(),
      price: Number.isFinite(price) ? price : 0,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await setJson(MENU_KEY, list);
    return item;
  });
}

async function updateMenuItem(id: string, name: string, price: number): Promise<MenuItem | null> {
  return withLock("menu", async () => {
    const list = await getJson<MenuItem[]>(MENU_KEY, []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], name: name.trim(), price: Number.isFinite(price) ? price : 0 };
    await setJson(MENU_KEY, list);
    return list[idx];
  });
}

async function deleteMenuItem(id: string): Promise<void> {
  return withLock("menu", async () => {
    const list = await getJson<MenuItem[]>(MENU_KEY, []);
    await setJson(
      MENU_KEY,
      list.filter((m) => m.id !== id)
    );
  });
}

/* ---------------- 注文 ---------------- */

// 金額・支払い状況の項目を追加する前に保存された注文でも壊れないようにする。
// 旧形式（isPaid: boolean）のデータは paymentStatus へ移行する。
function normalizeOrder(o: Order & { isPaid?: boolean }): Order {
  const paymentStatus: PaymentStatus =
    o.paymentStatus === "unpaid" || o.paymentStatus === "claimed" || o.paymentStatus === "paid"
      ? o.paymentStatus
      : o.isPaid === true
        ? "paid"
        : "unpaid";
  return {
    ...o,
    isLarge: o.isLarge === true,
    unitPrice: Number.isFinite(o.unitPrice) ? o.unitPrice : 0,
    largeExtra: Number.isFinite(o.largeExtra) ? o.largeExtra : 0,
    paymentStatus,
  };
}

async function readOrders(): Promise<Order[]> {
  const all = await getJson<Order[]>(ORDERS_KEY, []);
  return all.map(normalizeOrder);
}

async function listOrdersByDate(deliveryDate: string): Promise<Order[]> {
  const all = await readOrders();
  return all
    .filter((o) => o.deliveryDate === deliveryDate)
    .sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
}

async function listOrderDates(): Promise<string[]> {
  const all = await readOrders();
  const set = new Set(all.map((o) => o.deliveryDate));
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

async function findOrder(deliveryDate: string, name: string): Promise<Order | null> {
  const all = await readOrders();
  const trimmed = name.trim().toLowerCase();
  return (
    all.find((o) => o.deliveryDate === deliveryDate && o.name.trim().toLowerCase() === trimmed) ?? null
  );
}

async function getOrderById(id: string): Promise<Order | null> {
  const all = await readOrders();
  return all.find((o) => o.id === id) ?? null;
}

// 「同じ名前・同じ日付」で既存注文が見つかったとき、confirmOverwrite が true で
// なければ書き込まずに conflict を返す。同姓同名の別人の注文を静かに上書きしてしまう
// 事故を防ぐためのガード。既存注文の有無の確認と書き込みを同じロックの中で行うことで、
// ほぼ同時に2件送信された場合でも安全に判定できる（TOCTOUレースを避ける）。
async function upsertOrder(input: UpsertOrderInput): Promise<UpsertOrderResult> {
  return withLock("orders", async () => {
    const all = await readOrders();
    const now = new Date().toISOString();
    // findOrder と同じ「前後の空白を無視・大文字小文字を無視」の比較にする。
    // ここがずれていると、同じ人のつもりの注文が二重に登録されてしまう。
    const targetName = input.name.trim().toLowerCase();
    const idx = all.findIndex(
      (o) => o.deliveryDate === input.deliveryDate && o.name.trim().toLowerCase() === targetName
    );

    if (idx !== -1 && !input.confirmOverwrite) {
      return { ok: false, conflict: true, existing: all[idx] };
    }

    const previous = idx !== -1 ? all[idx] : null;
    let record: Order;
    if (idx !== -1) {
      // 内容を変更しても、管理者が確認済みにした支払い状況は引き継ぐ
      record = {
        ...all[idx],
        menuItem: input.menuItem,
        isLarge: input.isLarge,
        unitPrice: input.unitPrice,
        largeExtra: input.largeExtra,
        paymentMethod: input.paymentMethod,
        orderedVia: input.orderedVia,
        orderedAt: now,
      };
      all[idx] = record;
    } else {
      record = {
        id: randomUUID(),
        deliveryDate: input.deliveryDate,
        orderedVia: input.orderedVia,
        name: input.name,
        menuItem: input.menuItem,
        isLarge: input.isLarge,
        unitPrice: input.unitPrice,
        largeExtra: input.largeExtra,
        paymentMethod: input.paymentMethod,
        paymentStatus: "unpaid",
        orderedAt: now,
      };
      all.push(record);
    }
    await setJson(ORDERS_KEY, all);
    return { ok: true, order: record, isEdit: idx !== -1, previous };
  });
}

async function deleteOrder(id: string): Promise<void> {
  return withLock("orders", async () => {
    const all = await readOrders();
    await setJson(
      ORDERS_KEY,
      all.filter((o) => o.id !== id)
    );
  });
}

async function setOrderPaymentStatus(
  id: string,
  status: PaymentStatus,
  meta?: { confirmedBy?: string }
): Promise<Order | null> {
  return withLock("orders", async () => {
    const all = await readOrders();
    const idx = all.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      paymentStatus: status,
      ...(status === "paid" ? { paymentConfirmedAt: now } : {}),
    };
    await setJson(ORDERS_KEY, all);
    return all[idx];
  });
}

// 本人が「渡しました」と申告する。unpaid の場合のみ claimed に進める（冪等・多重通知防止）。
async function claimOrderPaid(deliveryDate: string, name: string): Promise<{ order: Order; changed: boolean } | null> {
  return withLock("orders", async () => {
    const all = await readOrders();
    const trimmed = name.trim().toLowerCase();
    const idx = all.findIndex(
      (o) => o.deliveryDate === deliveryDate && o.name.trim().toLowerCase() === trimmed
    );
    if (idx === -1) return null;
    const changed = all[idx].paymentStatus === "unpaid";
    if (changed) {
      all[idx] = { ...all[idx], paymentStatus: "claimed", paymentClaimedAt: new Date().toISOString() };
      await setJson(ORDERS_KEY, all);
    }
    return { order: all[idx], changed };
  });
}

/* ---------------- LINE連携 ---------------- */

function lineLinkKey(name: string): string {
  return name.trim().toLowerCase();
}

async function getLineLinkByName(name: string): Promise<LineLink | null> {
  const all = await getJson<LineLink[]>(LINE_LINKS_KEY, []);
  const key = lineLinkKey(name);
  return all.find((l) => lineLinkKey(l.name) === key) ?? null;
}

async function upsertLineLink(name: string, lineUserId: string, displayName: string): Promise<LineLink> {
  return withLock("lineLinks", async () => {
    const all = await getJson<LineLink[]>(LINE_LINKS_KEY, []);
    const key = lineLinkKey(name);
    const idx = all.findIndex((l) => lineLinkKey(l.name) === key);
    const record: LineLink = { name: name.trim(), lineUserId, displayName, linkedAt: new Date().toISOString() };
    if (idx === -1) {
      all.push(record);
    } else {
      all[idx] = record;
    }
    await setJson(LINE_LINKS_KEY, all);
    return record;
  });
}

async function listLineLinks(): Promise<LineLink[]> {
  return getJson<LineLink[]>(LINE_LINKS_KEY, []);
}

/* ---------------- 設定 ---------------- */

async function getSettings(): Promise<Settings> {
  const raw = await getJson<Partial<Settings> | null>(SETTINGS_KEY, null);
  return normalizeSettings(raw);
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return withLock("settings", async () => {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...patch });
    await setJson(SETTINGS_KEY, next);
    return next;
  });
}

/* ---------------- 画像 ---------------- */

async function getImageInfo(): Promise<ImageInfo> {
  return getJson<ImageInfo>(IMAGE_META_KEY, null);
}

async function saveImageFile(buffer: Buffer, ext: string): Promise<ImageInfo> {
  const base64 = buffer.toString("base64");
  await setJson(IMAGE_DATA_KEY, base64);
  const info: ImageInfo = { ext, updatedAt: new Date().toISOString() };
  await setJson(IMAGE_META_KEY, info);
  return info;
}

async function getImageFile(): Promise<{ buffer: Buffer; contentType: string } | null> {
  const info = await getJson<ImageInfo>(IMAGE_META_KEY, null);
  if (!info?.ext) return null;
  const base64 = await getJson<string | null>(IMAGE_DATA_KEY, null);
  if (!base64 || typeof base64 !== "string") return null;
  return {
    buffer: Buffer.from(base64, "base64"),
    contentType: IMAGE_MIME[info.ext] ?? "application/octet-stream",
  };
}

export const redisStore: StoreBackend = {
  listNames,
  addName,
  updateNameItem,
  deleteNameItem,
  listMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listOrdersByDate,
  listOrderDates,
  findOrder,
  getOrderById,
  upsertOrder,
  deleteOrder,
  setOrderPaymentStatus,
  claimOrderPaid,
  getSettings,
  saveSettings,
  getImageInfo,
  saveImageFile,
  getImageFile,
  getLineLinkByName,
  upsertLineLink,
  listLineLinks,
};
