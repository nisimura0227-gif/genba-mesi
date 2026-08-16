// 日本時間(JST)まわりのユーティリティ。
// サーバーのタイムゾーン設定に依存しないよう、常に Intl.DateTimeFormat で
// Asia/Tokyo を明示して計算する。

import type { Settings } from "./storeTypes";

const TZ = "Asia/Tokyo";
/** JSTはUTC+9固定（サマータイムが無い） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export type JstParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
};

export function getJstParts(date: Date = new Date()): JstParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// "YYYY-MM-DD" 形式（JST基準）
export function dateStrFromParts(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function todayStr(now: Date = new Date()): string {
  return dateStrFromParts(getJstParts(now));
}

export function tomorrowStr(now: Date = new Date()): string {
  const p = getJstParts(now);
  // 日付だけのUTC基準Dateで1日進める（JSTにはDSTが無いので安全）
  const asUtc = Date.UTC(p.year, p.month - 1, p.day);
  const next = new Date(asUtc + 24 * 60 * 60 * 1000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

// HH:MM (JST)
export function formatTimeHm(date: Date = new Date()): string {
  const p = getJstParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD" -> "8月4日(火)"
export function formatDateJp(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const w = WEEKDAYS_JP[utc.getUTCDay()];
  return `${m}月${d}日(${w})`;
}

/** 締切時刻の表示用ラベル（例: "7:55"） */
export function formatCutoffLabel(hour: number, minute: number): string {
  return `${hour}:${pad2(minute)}`;
}

/** 本日の受付締切（JST）を過ぎたかどうか */
export function isTodayOrderClosed(cutoffHour: number, cutoffMinute: number, now: Date = new Date()): boolean {
  const p = getJstParts(now);
  return p.hour * 60 + p.minute >= cutoffHour * 60 + cutoffMinute;
}

/**
 * 本日の締切時刻を絶対時刻（エポックミリ秒）で返す。
 * 端末のタイムゾーン設定がずれていても残り時間を正しく計算できるようにするため、
 * 画面側へはこの絶対時刻を渡して使う。
 */
export function cutoffEpochMs(cutoffHour: number, cutoffMinute: number, now: Date = new Date()): number {
  const p = getJstParts(now);
  // JST の Y/M/D H:M は UTC では9時間前
  return Date.UTC(p.year, p.month - 1, p.day, cutoffHour, cutoffMinute) - JST_OFFSET_MS;
}

// dateStr（YYYY-MM-DD, JST基準）が「今日から数えて過去days日以内」かどうか
export function isWithinLastDays(dateStr: string, days: number, now: Date = new Date()): boolean {
  const p = getJstParts(now);
  const todayUtc = Date.UTC(p.year, p.month - 1, p.day);
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);
  const diffDays = Math.floor((todayUtc - targetUtc) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays < days;
}

/** "YYYY-MM-DD" の曜日を返す（0=日, 1=月, ..., 6=土）。日付だけの比較なのでJSTの時差を気にしなくてよい */
export function dayOfWeekFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * 指定した日（お弁当を食べる日）の注文受付が休工扱いかどうかを判定する。
 * ルール（優先順）：
 * 1. 管理者が手動で休工モードをONにしている間は、曜日に関わらず常に休工
 * 2. 土曜日・日曜日は、その日が settings.workingWeekends に
 *    「営業日」として登録されていない限り休工
 * 3. 平日は休工ではない
 */
export function isOrderingPausedForDate(settings: Settings, dateStr: string): boolean {
  if (settings.orderingPaused) return true;
  const dow = dayOfWeekFromDateStr(dateStr);
  const isWeekend = dow === 0 || dow === 6;
  if (!isWeekend) return false;
  return !settings.workingWeekends.includes(dateStr);
}
