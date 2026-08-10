import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/store";
import { formatCutoffLabel, isTodayOrderClosed } from "@/lib/date";
import { notifyTomorrowReminder } from "@/lib/notify";

export const runtime = "nodejs";

// Vercel Cron から毎日14:00(JST)に呼ばれる想定（＝明日の注文の締切1時間前）。CRON_SECRETで保護する。
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "権限がありません。" }, { status: 401 });
  }

  const settings = await getSettings();
  // 管理者が締切時刻を早めた等で、実行時点ですでに締切を過ぎている場合は送らない
  // （締切後に「まだ注文できます」と案内してしまう事故を防ぐ）。
  if (isTodayOrderClosed(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute)) {
    return NextResponse.json({ ok: true, skipped: "cutoff already passed" });
  }

  const cutoffLabel = formatCutoffLabel(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute);
  await notifyTomorrowReminder(cutoffLabel);

  return NextResponse.json({ ok: true });
}
