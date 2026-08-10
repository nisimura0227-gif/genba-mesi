// データストアが扱う型定義。file / redis どちらのバックエンドも
// この形に合わせて実装する。

export type NameItem = { id: string; name: string; createdAt: string };

export type MenuItem = { id: string; name: string; price: number; createdAt: string };

/**
 * 支払い状況の3段階。
 * unpaid  = 支払い待ち
 * claimed = 本人が「渡しました」と申告した（未確定）
 * paid    = 管理者が実際に受け取ったことを確認した（確定）
 * 「本人が渡したと言っただけでは支払い済みにしない」というルールを型で保証する。
 */
export type PaymentStatus = "unpaid" | "claimed" | "paid";

export type Order = {
  id: string;
  deliveryDate: string; // "YYYY-MM-DD" お弁当を食べる日
  orderedVia: "today" | "tomorrow";
  name: string;
  menuItem: string;
  isLarge: boolean; // 大盛り
  /** 注文時点のメニュー単価。後でメニューの金額を変えても過去の注文がずれないよう記録しておく */
  unitPrice: number;
  /** 注文時点の大盛り追加料金。大盛りでなければ 0 */
  largeExtra: number;
  paymentMethod: string;
  /** 支払い状況（3段階） */
  paymentStatus: PaymentStatus;
  /** 本人が「渡しました」と申告した日時（ISO） */
  paymentClaimedAt?: string;
  /** 管理者が受け取りを確認した日時（ISO） */
  paymentConfirmedAt?: string;
  orderedAt: string; // ISO timestamp
};

export type ImageInfo = { ext: string; updatedAt: string } | null;

export type UpsertOrderInput = {
  deliveryDate: string;
  orderedVia: "today" | "tomorrow";
  name: string;
  menuItem: string;
  isLarge: boolean;
  unitPrice: number;
  largeExtra: number;
  paymentMethod: string;
  /**
   * true のときだけ、既存注文（同じ名前・同じ日付）を上書きしてよい。
   * false で既存注文が見つかった場合は書き込みを行わず conflict を返す。
   * 「同姓同名の別人の注文を静かに上書きしてしまう」事故を防ぐためのガード。
   */
  confirmOverwrite: boolean;
};

export type UpsertOrderResult =
  | { ok: true; order: Order; isEdit: boolean; previous: Order | null }
  | { ok: false; conflict: true; existing: Order };

/** LINEの利用者アカウントと、サイト上の「名前」を紐付けるための記録。 */
export type LineLink = {
  name: string;
  lineUserId: string;
  displayName: string;
  linkedAt: string;
};

/** 管理者としてLINE通知を受け取るLINEアカウント */
export type AdminLineUser = { lineUserId: string; displayName: string };

/** 管理画面から変更できる設定。まとめて1つのオブジェクトとして保存する。 */
export type Settings = {
  /** 現在の担当者名。一般ユーザー画面にも表示される */
  adminName: string;
  /** 今日の注文の受付締切（JST） */
  cutoffHour: number;
  cutoffMinute: number;
  /** 明日の注文の受付締切（JST・前日の時刻） */
  tomorrowCutoffHour: number;
  tomorrowCutoffMinute: number;
  /** 大盛りの追加料金（円） */
  largeExtraPrice: number;
  /** お弁当屋の電話番号 */
  shopPhone: string;
  /** 管理者としてLINE通知を受け取るLINEアカウント（複数人登録可＝管理者不在時の保険） */
  adminLineUsers: AdminLineUser[];
  /** 新規注文が入るたびに管理者へ即時LINE通知するか */
  notifyNewOrder: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  adminName: "管理者",
  cutoffHour: 7,
  cutoffMinute: 55,
  tomorrowCutoffHour: 15,
  tomorrowCutoffMinute: 0,
  largeExtraPrice: 100,
  shopPhone: "070-6426-7880",
  adminLineUsers: [],
  notifyNewOrder: true,
};

/** 保存されている設定に足りない項目があってもアプリが壊れないよう既定値で補う */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = raw ?? {};
  const int = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };
  const hour = Math.min(23, Math.max(0, int(s.cutoffHour, DEFAULT_SETTINGS.cutoffHour)));
  const minute = Math.min(59, Math.max(0, int(s.cutoffMinute, DEFAULT_SETTINGS.cutoffMinute)));
  const tomorrowHour = Math.min(23, Math.max(0, int(s.tomorrowCutoffHour, DEFAULT_SETTINGS.tomorrowCutoffHour)));
  const tomorrowMinute = Math.min(59, Math.max(0, int(s.tomorrowCutoffMinute, DEFAULT_SETTINGS.tomorrowCutoffMinute)));
  const seenIds = new Set<string>();
  const adminLineUsers = Array.isArray(s.adminLineUsers)
    ? s.adminLineUsers.filter((u): u is AdminLineUser => {
        if (!u || typeof u !== "object") return false;
        const id = (u as AdminLineUser).lineUserId;
        if (typeof id !== "string" || !id.trim() || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
    : DEFAULT_SETTINGS.adminLineUsers;
  return {
    adminName: (typeof s.adminName === "string" && s.adminName.trim()) || DEFAULT_SETTINGS.adminName,
    cutoffHour: hour,
    cutoffMinute: minute,
    tomorrowCutoffHour: tomorrowHour,
    tomorrowCutoffMinute: tomorrowMinute,
    largeExtraPrice: Math.max(0, int(s.largeExtraPrice, DEFAULT_SETTINGS.largeExtraPrice)),
    shopPhone: (typeof s.shopPhone === "string" && s.shopPhone.trim()) || DEFAULT_SETTINGS.shopPhone,
    adminLineUsers,
    notifyNewOrder: typeof s.notifyNewOrder === "boolean" ? s.notifyNewOrder : DEFAULT_SETTINGS.notifyNewOrder,
  };
}

export const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// 支払い方法は「手渡し」に統一（現金ケースへの投函は事故防止のため廃止した）
export const PAYMENT_METHOD = "手渡し";

/** 注文1件の合計金額（単価 + 大盛り追加料金） */
export function orderTotal(order: Pick<Order, "unitPrice" | "largeExtra">): number {
  const unit = Number.isFinite(order.unitPrice) ? order.unitPrice : 0;
  const extra = Number.isFinite(order.largeExtra) ? order.largeExtra : 0;
  return unit + extra;
}

/** 表示用の支払い状況ラベル */
export function paymentStatusLabel(status: PaymentStatus): string {
  if (status === "paid") return "支払い済み";
  if (status === "claimed") return "申告済み（確認待ち）";
  return "支払い待ち";
}

export interface StoreBackend {
  listNames(): Promise<NameItem[]>;
  addName(name: string): Promise<NameItem>;
  updateNameItem(id: string, name: string): Promise<NameItem | null>;
  deleteNameItem(id: string): Promise<void>;

  listMenuItems(): Promise<MenuItem[]>;
  addMenuItem(name: string, price: number): Promise<MenuItem>;
  updateMenuItem(id: string, name: string, price: number): Promise<MenuItem | null>;
  deleteMenuItem(id: string): Promise<void>;

  listOrdersByDate(deliveryDate: string): Promise<Order[]>;
  listOrderDates(): Promise<string[]>;
  findOrder(deliveryDate: string, name: string): Promise<Order | null>;
  upsertOrder(input: UpsertOrderInput): Promise<UpsertOrderResult>;
  deleteOrder(id: string): Promise<void>;
  /** 管理者がサイト上または管理者LINEから支払い状況を確定・変更する */
  setOrderPaymentStatus(
    id: string,
    status: PaymentStatus,
    meta?: { confirmedBy?: string }
  ): Promise<Order | null>;
  /**
   * 本人が「渡しました」と申告する（unpaid のときのみ有効。冪等）。
   * changed が true のときだけ、実際に unpaid→claimed へ遷移したことを示す
   * （既に claimed/paid だった場合は false。呼び出し側の多重通知防止に使う）。
   */
  claimOrderPaid(deliveryDate: string, name: string): Promise<{ order: Order; changed: boolean } | null>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;

  getImageInfo(): Promise<ImageInfo>;
  saveImageFile(buffer: Buffer, ext: string): Promise<ImageInfo>;
  getImageFile(): Promise<{ buffer: Buffer; contentType: string } | null>;

  /* ---------------- LINE連携 ---------------- */
  getLineLinkByName(name: string): Promise<LineLink | null>;
  upsertLineLink(name: string, lineUserId: string, displayName: string): Promise<LineLink>;
  listLineLinks(): Promise<LineLink[]>;
}
