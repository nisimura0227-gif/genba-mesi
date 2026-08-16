// ローカル動作確認用のJSONファイルバックエンド。
// Upstash Redis の環境変数が設定されていないとき（ローカル開発時など）に使われる。
// 本番のVercel（サーバーレス）ではファイル書き込みが永続化されないため、
// redisStore.ts が自動的に使われる。

import fs from "fs/promises";
import path from "path";
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

const DB_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "db") : path.join(process.cwd(), "data", "db");
const SEED_DIR = path.join(process.cwd(), "data", "seed");

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(
    key,
    prev.then(() => next)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

async function ensureDb(file: string): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  const dbPath = path.join(DB_DIR, file);
  try {
    await fs.access(dbPath);
  } catch {
    const seedPath = path.join(SEED_DIR, file);
    try {
      const seedData = await fs.readFile(seedPath, "utf-8");
      await fs.writeFile(dbPath, seedData, "utf-8");
    } catch {
      await fs.writeFile(dbPath, "[]", "utf-8");
    }
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDb(file);
  const dbPath = path.join(DB_DIR, file);
  try {
    const raw = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  const dbPath = path.join(DB_DIR, file);
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

/* ---------------- 名前 ---------------- */

async function listNames(): Promise<NameItem[]> {
  return readJson<NameItem[]>("names.json", []);
}

async function addName(name: string): Promise<NameItem> {
  return withLock("names.json", async () => {
    const list = await readJson<NameItem[]>("names.json", []);
    const trimmed = name.trim();
    const existing = list.find((n) => n.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const item: NameItem = { id: randomUUID(), name: trimmed, createdAt: new Date().toISOString() };
    list.push(item);
    await writeJson("names.json", list);
    return item;
  });
}

async function updateNameItem(id: string, name: string): Promise<NameItem | null> {
  return withLock("names.json", async () => {
    const list = await readJson<NameItem[]>("names.json", []);
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], name: name.trim() };
    await writeJson("names.json", list);
    return list[idx];
  });
}

async function deleteNameItem(id: string): Promise<void> {
  return withLock("names.json", async () => {
    const list = await readJson<NameItem[]>("names.json", []);
    await writeJson(
      "names.json",
      list.filter((n) => n.id !== id)
    );
  });
}

/* ---------------- メニュー ---------------- */

async function listMenuItems(): Promise<MenuItem[]> {
  const list = await readJson<MenuItem[]>("menu.json", []);
  // 金額項目を追加する前に登録されたメニューには price が無いため補正する。
  return list.map((m) => ({ ...m, price: Number.isFinite(m.price) ? m.price : 0 }));
}

async function addMenuItem(name: string, price: number): Promise<MenuItem> {
  return withLock("menu.json", async () => {
    const list = await readJson<MenuItem[]>("menu.json", []);
    const item: MenuItem = {
      id: randomUUID(),
      name: name.trim(),
      price: Number.isFinite(price) ? price : 0,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await writeJson("menu.json", list);
    return item;
  });
}

async function updateMenuItem(id: string, name: string, price: number): Promise<MenuItem | null> {
  return withLock("menu.json", async () => {
    const list = await readJson<MenuItem[]>("menu.json", []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], name: name.trim(), price: Number.isFinite(price) ? price : 0 };
    await writeJson("menu.json", list);
    return list[idx];
  });
}

async function deleteMenuItem(id: string): Promise<void> {
  return withLock("menu.json", async () => {
    const list = await readJson<MenuItem[]>("menu.json", []);
    await writeJson(
      "menu.json",
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
  const all = await readJson<Order[]>("orders.json", []);
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
  return withLock("orders.json", async () => {
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
    await writeJson("orders.json", all);
    return { ok: true, order: record, isEdit: idx !== -1, previous };
  });
}

async function deleteOrder(id: string): Promise<void> {
  return withLock("orders.json", async () => {
    const all = await readOrders();
    await writeJson(
      "orders.json",
      all.filter((o) => o.id !== id)
    );
  });
}

async function setOrderPaymentStatus(
  id: string,
  status: PaymentStatus,
  meta?: { confirmedBy?: string }
): Promise<Order | null> {
  return withLock("orders.json", async () => {
    const all = await readOrders();
    const idx = all.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      paymentStatus: status,
      ...(status === "paid" ? { paymentConfirmedAt: now } : {}),
    };
    await writeJson("orders.json", all);
    return all[idx];
  });
}

// 本人が「渡しました」と申告する。unpaid の場合のみ claimed に進める（冪等・多重通知防止）。
async function claimOrderPaid(deliveryDate: string, name: string): Promise<{ order: Order; changed: boolean } | null> {
  return withLock("orders.json", async () => {
    const all = await readOrders();
    const trimmed = name.trim().toLowerCase();
    const idx = all.findIndex(
      (o) => o.deliveryDate === deliveryDate && o.name.trim().toLowerCase() === trimmed
    );
    if (idx === -1) return null;
    const changed = all[idx].paymentStatus === "unpaid";
    if (changed) {
      all[idx] = { ...all[idx], paymentStatus: "claimed", paymentClaimedAt: new Date().toISOString() };
      await writeJson("orders.json", all);
    }
    return { order: all[idx], changed };
  });
}

/* ---------------- LINE連携 ---------------- */

function lineLinkKey(name: string): string {
  return name.trim().toLowerCase();
}

async function readLineLinks(): Promise<LineLink[]> {
  return readJson<LineLink[]>("lineLinks.json", []);
}

async function getLineLinkByName(name: string): Promise<LineLink | null> {
  const all = await readLineLinks();
  const key = lineLinkKey(name);
  return all.find((l) => lineLinkKey(l.name) === key) ?? null;
}

async function upsertLineLink(name: string, lineUserId: string, displayName: string): Promise<LineLink> {
  return withLock("lineLinks.json", async () => {
    const all = await readLineLinks();
    const key = lineLinkKey(name);
    const idx = all.findIndex((l) => lineLinkKey(l.name) === key);
    const record: LineLink = { name: name.trim(), lineUserId, displayName, linkedAt: new Date().toISOString() };
    if (idx === -1) {
      all.push(record);
    } else {
      all[idx] = record;
    }
    await writeJson("lineLinks.json", all);
    return record;
  });
}

async function listLineLinks(): Promise<LineLink[]> {
  return readLineLinks();
}

/* ---------------- 設定 ---------------- */

async function getSettings(): Promise<Settings> {
  const raw = await readJson<Partial<Settings> | null>("settings.json", null);
  return normalizeSettings(raw);
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return withLock("settings.json", async () => {
    const raw = await readJson<Partial<Settings> | null>("settings.json", null);
    const next = normalizeSettings({ ...normalizeSettings(raw), ...patch });
    await writeJson("settings.json", next);
    return next;
  });
}

/* ---------------- 画像 ---------------- */

async function getImageInfo(): Promise<ImageInfo> {
  return readJson<ImageInfo>("image.json", null);
}

async function saveImageFile(buffer: Buffer, ext: string): Promise<ImageInfo> {
  return withLock("image.json", async () => {
    await fs.mkdir(DB_DIR, { recursive: true });
    const prev = await readJson<ImageInfo>("image.json", null);
    if (prev?.ext) {
      await fs.unlink(path.join(DB_DIR, `menu-image.${prev.ext}`)).catch(() => {});
    }
    await fs.writeFile(path.join(DB_DIR, `menu-image.${ext}`), buffer);
    const info: ImageInfo = { ext, updatedAt: new Date().toISOString() };
    await writeJson("image.json", info);
    return info;
  });
}

async function getImageFile(): Promise<{ buffer: Buffer; contentType: string } | null> {
  const info = await readJson<ImageInfo>("image.json", null);
  if (!info?.ext) return null;
  try {
    const buffer = await fs.readFile(path.join(DB_DIR, `menu-image.${info.ext}`));
    return { buffer, contentType: IMAGE_MIME[info.ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export const fileStore: StoreBackend = {
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
