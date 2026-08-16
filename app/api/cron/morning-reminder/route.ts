import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/store";
import { formatCutoffLabel, todayStr, dayOfWeekFromDateStr } from "@/lib/date";
import { notifyMorningReminder } from "@/lib/notify";

export const runtime = "nodejs";

// Vercel Cron から毎朝6:30(JST)に呼ばれる想定。CRON_SECRETで保護する。
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "権限がありません。" }, { status: 401 });
  }

  // 朝の定期リマインドは月〜金のみ。土日は「営業日」として登録されていても送らない
  // （注文の受付可否とLINE通知の可否は別で管理する）。
  const dow = dayOfWeekFromDateStr(todayStr());
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ ok: true, skipped: "weekend" });
  }

  const settings = await getSettings();
  const cutoffLabel = formatCutoffLabel(settings.cutoffHour, settings.cutoffMinute);
  await notifyMorningReminder(cutoffLabel);

  return NextResponse.json({ ok: true });
}
