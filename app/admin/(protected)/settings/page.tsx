"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/storeTypes";
import { Input, FieldLabel, HelpText } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import AdminLineLinkSection from "@/components/AdminLineLinkSection";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [adminName, setAdminName] = useState("");
  const [cutoff, setCutoff] = useState("07:55");
  const [tomorrowCutoff, setTomorrowCutoff] = useState("15:00");
  const [largeExtraPrice, setLargeExtraPrice] = useState("100");
  const [shopPhone, setShopPhone] = useState("");
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [orderingPaused, setOrderingPaused] = useState(false);
  const [adminLineUsers, setAdminLineUsers] = useState<Settings["adminLineUsers"]>([]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const s: Settings | undefined = data.settings;
        if (s) {
          setAdminName(s.adminName);
          setCutoff(`${pad2(s.cutoffHour)}:${pad2(s.cutoffMinute)}`);
          setTomorrowCutoff(`${pad2(s.tomorrowCutoffHour)}:${pad2(s.tomorrowCutoffMinute)}`);
          setLargeExtraPrice(String(s.largeExtraPrice));
          setShopPhone(s.shopPhone);
          setNotifyNewOrder(s.notifyNewOrder);
          setOrderingPaused(s.orderingPaused);
          setAdminLineUsers(s.adminLineUsers);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);

    const [h, m] = cutoff.split(":").map(Number);
    const [th, tm] = tomorrowCutoff.split(":").map(Number);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminName: adminName.trim(),
          cutoffHour: h,
          cutoffMinute: m,
          tomorrowCutoffHour: th,
          tomorrowCutoffMinute: tm,
          largeExtraPrice: Number(largeExtraPrice || 0),
          shopPhone: shopPhone.trim(),
          notifyNewOrder,
          orderingPaused,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "保存に失敗しました。");
      } else {
        setSaved(true);
        // 他の画面（トップページの担当者名など）にも反映させる
        router.refresh();
      }
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-400">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <h2 className="text-base font-bold text-brand-dark">⚙️ 設定</h2>

        <Card className="border-2 border-accent/30 bg-accent-soft">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold text-accent-dark">🚧 休工モード（注文受付を停止）</span>
              <span className="mt-1 block text-xs leading-relaxed text-accent-dark">
                ONにすると、今日・明日どちらの注文ページにも「本日は注文を受け付けていません」と表示され、新しい注文を受け付けなくなります。
              </span>
            </span>
            <input
              type="checkbox"
              checked={orderingPaused}
              onChange={(e) => setOrderingPaused(e.target.checked)}
              className="h-5 w-5 flex-shrink-0 accent-accent"
            />
          </label>
        </Card>

        <Card className="flex flex-col gap-6">
          <div>
            <FieldLabel>担当者名</FieldLabel>
            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} maxLength={20} required />
            <HelpText>一般ユーザーのトップページにも表示されます。</HelpText>
          </div>

          <div>
            <FieldLabel>今日の注文の締切時刻</FieldLabel>
            <Input type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} required />
            <HelpText>この時刻を過ぎると今日の注文ができなくなります。</HelpText>
          </div>

          <div>
            <FieldLabel>明日の注文の締切時刻（本日中）</FieldLabel>
            <Input type="time" value={tomorrowCutoff} onChange={(e) => setTomorrowCutoff(e.target.value)} required />
            <HelpText>
              明日のお弁当は前日払い制です。この時刻（本日）を過ぎると明日の注文ができなくなります。
            </HelpText>
          </div>

          <div>
            <FieldLabel>大盛りの追加料金（円）</FieldLabel>
            <Input
              value={largeExtraPrice}
              onChange={(e) => setLargeExtraPrice(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              required
            />
            <HelpText>変更しても、すでに入っている注文の金額はそのまま残ります。</HelpText>
          </div>

          <div>
            <FieldLabel>お弁当屋の電話番号</FieldLabel>
            <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} inputMode="tel" required />
            <HelpText>管理画面の「お弁当屋へ電話する」ボタンで使われます。</HelpText>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-gray-200 px-4 py-3.5">
            <span className="text-sm font-bold text-gray-800">
              新しい注文が入るたびにLINEへ即時通知する
            </span>
            <input
              type="checkbox"
              checked={notifyNewOrder}
              onChange={(e) => setNotifyNewOrder(e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
          </label>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}
        {saved && (
          <p className="rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
            設定を保存しました。
          </p>
        )}

        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "保存中..." : "設定を保存する"}
        </Button>
      </form>

      <AdminLineLinkSection initialUsers={adminLineUsers} />
    </div>
  );
}
