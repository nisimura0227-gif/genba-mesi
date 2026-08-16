import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import { isAdminRequest } from "@/lib/authGuard";
import type { Settings } from "@/lib/store";

export const runtime = "nodejs";

// 設定の取得（管理画面用）
export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ message: "権限がありません。" }, { status: 401 });
  }
  return NextResponse.json({ settings: await getSettings() });
}

// 設定の保存（管理者のみ）
export async function PUT(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ message: "権限がありません。" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "入力内容が正しくありません。" }, { status: 400 });
  }

  const patch: Partial<Settings> = {};

  if (typeof body.adminName === "string") {
    const v = body.adminName.trim();
    if (!v) {
      return NextResponse.json({ message: "担当者名を入力してください。" }, { status: 400 });
    }
    if (v.length > 20) {
      return NextResponse.json({ message: "担当者名は20文字以内で入力してください。" }, { status: 400 });
    }
    patch.adminName = v;
  }

  if (body.cutoffHour !== undefined || body.cutoffMinute !== undefined) {
    const h = Number(body.cutoffHour);
    const m = Number(body.cutoffMinute);
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      return NextResponse.json({ message: "締切時刻が正しくありません。" }, { status: 400 });
    }
    patch.cutoffHour = h;
    patch.cutoffMinute = m;
  }

  if (body.tomorrowCutoffHour !== undefined || body.tomorrowCutoffMinute !== undefined) {
    const h = Number(body.tomorrowCutoffHour);
    const m = Number(body.tomorrowCutoffMinute);
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      return NextResponse.json({ message: "明日の注文の締切時刻が正しくありません。" }, { status: 400 });
    }
    patch.tomorrowCutoffHour = h;
    patch.tomorrowCutoffMinute = m;
  }

  if (typeof body.notifyNewOrder === "boolean") {
    patch.notifyNewOrder = body.notifyNewOrder;
  }

  if (typeof body.orderingPaused === "boolean") {
    patch.orderingPaused = body.orderingPaused;
  }

  if (body.largeExtraPrice !== undefined) {
    const p = Number(body.largeExtraPrice);
    if (!Number.isFinite(p) || p < 0 || p > 100000) {
      return NextResponse.json({ message: "大盛りの追加料金が正しくありません。" }, { status: 400 });
    }
    patch.largeExtraPrice = Math.trunc(p);
  }

  if (typeof body.shopPhone === "string") {
    const v = body.shopPhone.trim();
    if (!/^[0-9+\-() ]{6,20}$/.test(v)) {
      return NextResponse.json({ message: "電話番号の形式が正しくありません。" }, { status: 400 });
    }
    patch.shopPhone = v;
  }

  const settings = await saveSettings(patch);
  return NextResponse.json({ settings });
}
