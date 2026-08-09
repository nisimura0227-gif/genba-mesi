"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHOD, type PaymentStatus } from "@/lib/storeTypes";
import { loadSavedName, saveName } from "@/lib/savedName";
import { useCountdown } from "./useCountdown";
import LiffLink from "./LiffLink";
import Button from "./ui/Button";
import { Card, CardSection } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Input, Select, FieldLabel, HelpText } from "./ui/Field";

type NameLite = { id: string; name: string };
type MenuLite = { id: string; name: string; price: number };

/** 現在の自分の注文内容 */
type MyOrder = {
  menuItem: string;
  isLarge: boolean;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  total: number;
};

function yen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

export default function OrderForm({
  orderedVia,
  names,
  menuItems,
  largeExtraPrice,
  cutoffAtMs,
  serverNowMs,
  cutoffNotice,
  adminName,
  cutoffLabel,
}: {
  orderedVia: "today" | "tomorrow";
  names: NameLite[];
  menuItems: MenuLite[];
  largeExtraPrice: number;
  cutoffAtMs: number;
  serverNowMs: number;
  /** 締切・支払いに関する案内文（今日/明日で内容が異なる） */
  cutoffNotice: string;
  /** 支払い相手（担当者名） */
  adminName: string;
  /** 「〇時まで」の表示用ラベル（例: 15:00） */
  cutoffLabel: string;
}) {
  const router = useRouter();

  const { closed } = useCountdown(cutoffAtMs, serverNowMs);

  const [phase, setPhase] = useState<"loading" | "form" | "done">("loading");
  const [myOrder, setMyOrder] = useState<MyOrder | null>(null);

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [menuItem, setMenuItem] = useState("");
  const [isLarge, setIsLarge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /** 保存済みの名前で、すでに注文が入っていないか確認する */
  const checkExistingOrder = useCallback(
    async (targetName: string) => {
      try {
        const res = await fetch(
          `/api/orders/mine?name=${encodeURIComponent(targetName)}&via=${orderedVia}`,
          { cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return (data.order as MyOrder | null) ?? null;
      } catch {
        return null;
      }
    },
    [orderedVia]
  );

  // 画面を開いたとき：保存済みの名前を読み込み、注文済みなら完了画面を出す
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadSavedName();
      if (!saved) {
        if (!cancelled) {
          setEditingName(true);
          setPhase("form");
        }
        return;
      }
      const existing = await checkExistingOrder(saved);
      if (cancelled) return;
      setName(saved);
      if (existing) {
        setMyOrder(existing);
        setMenuItem(existing.menuItem);
        setIsLarge(existing.isLarge);
        setPhase("done");
      } else {
        setPhase("form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkExistingOrder]);

  const selectedMenu = menuItems.find((m) => m.name === menuItem) ?? null;
  const estimatedTotal = selectedMenu ? selectedMenu.price + (isLarge ? largeExtraPrice : 0) : 0;
  const canSubmit = Boolean(name.trim()) && Boolean(menuItem) && !submitting && !closed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedVia,
          name: name.trim(),
          menuItem,
          isLarge,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "注文に失敗しました。もう一度お試しください。");
        setSubmitting(false);
        return;
      }
      saveName(name);
      const o = data.order;
      setMyOrder({
        menuItem: o.menuItem,
        isLarge: o.isLarge,
        paymentMethod: o.paymentMethod,
        paymentStatus: (o.paymentStatus as PaymentStatus) ?? "unpaid",
        total: (o.unitPrice ?? 0) + (o.largeExtra ?? 0),
      });
      setEditingName(false);
      setPhase("done");
      setSubmitting(false);
    } catch {
      setError("通信エラーが発生しました。電波状況を確認してもう一度お試しください。");
      setSubmitting(false);
    }
  }

  async function handleClaimPaid() {
    if (claiming || !myOrder || myOrder.paymentStatus !== "unpaid") return;
    if (!confirm(`${adminName}さんに現金を手渡し済みですか？\n（まだの場合は先に手渡ししてから押してください）`)) return;
    setClaiming(true);
    setError("");
    try {
      const res = await fetch("/api/orders/mine/claim-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orderedVia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "送信に失敗しました。もう一度お試しください。");
        return;
      }
      setMyOrder((prev) => (prev ? { ...prev, paymentStatus: "claimed" } : prev));
    } catch {
      setError("通信エラーが発生しました。電波状況を確認してもう一度お試しください。");
    } finally {
      setClaiming(false);
    }
  }

  async function handleCancel() {
    if (cancelling || closed) return;
    if (!confirm("注文をキャンセルします。よろしいですか？")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(
        `/api/orders/mine?name=${encodeURIComponent(name)}&via=${orderedVia}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "キャンセルに失敗しました。もう一度お試しください。");
        return;
      }
      setMyOrder(null);
      setMenuItem("");
      setIsLarge(false);
      setPhase("form");
    } catch {
      setError("通信エラーが発生しました。電波状況を確認してもう一度お試しください。");
    } finally {
      setCancelling(false);
    }
  }

  if (phase === "loading") {
    return <p className="py-16 text-center text-sm text-gray-400">読み込み中...</p>;
  }

  /* ---------------- 注文済みの表示 ---------------- */
  if (phase === "done" && myOrder) {
    return (
      <div className="flex flex-col gap-5 py-4">
        <LiffLink name={name} />

        <Card className="border-2 border-brand bg-brand-light px-4 py-6 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-lg font-bold text-brand-dark">
            {orderedVia === "today" ? "本日の注文は完了しています" : "明日の注文は完了しています"}
          </p>
        </Card>

        <Card className="divide-y divide-gray-100 p-0 text-base">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">名前</span>
            <span className="font-bold text-gray-800">{name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">お弁当</span>
            <span className="font-bold text-gray-800">{myOrder.menuItem}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">大盛り</span>
            <span className="font-bold text-gray-800">{myOrder.isLarge ? "あり" : "なし"}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">支払い方法</span>
            <span className="text-right font-bold text-gray-800">{myOrder.paymentMethod}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">金額</span>
            <span className="font-bold text-gray-800">{yen(myOrder.total)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-gray-500">支払い状況</span>
            {myOrder.paymentStatus === "paid" ? (
              <Badge variant="success">✅ 支払い済み</Badge>
            ) : myOrder.paymentStatus === "claimed" ? (
              <Badge variant="warning">🙋 申告済み・確認待ち</Badge>
            ) : (
              <Badge variant="warning">⏳ 支払い待ち</Badge>
            )}
          </div>
        </Card>

        {orderedVia === "tomorrow" && myOrder.paymentStatus === "unpaid" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-center text-sm font-semibold text-accent-dark">
            🗓️ 本日中に {adminName}さんへ現金を手渡ししてください
          </p>
        )}

        {myOrder.paymentStatus === "unpaid" && (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="accent" size="lg" disabled={claiming} onClick={handleClaimPaid}>
              {claiming ? "送信中..." : "💰 支払いました（管理者へ知らせる）"}
            </Button>
            <HelpText>担当者に現金を手渡したあと押してください。担当者が受け取りを確認すると「支払い済み」になります。</HelpText>
          </div>
        )}
        {myOrder.paymentStatus === "claimed" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-center text-sm font-semibold text-accent-dark">
            🙋 申告済みです。担当者の確認をお待ちください。
          </p>
        )}

        {closed ? (
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
            受付時間を過ぎたため、変更・キャンセルできません。
          </p>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setPhase("form");
                setError("");
              }}
            >
              ✏️ 注文内容を変更する
            </Button>
            <Button type="button" variant="danger" size="lg" disabled={cancelling} onClick={handleCancel}>
              {cancelling ? "処理中..." : "❌ 注文をキャンセルする"}
            </Button>
          </>
        )}

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

        <Button type="button" variant="primary" size="lg" onClick={() => router.push("/")}>
          トップへ戻る
        </Button>
      </div>
    );
  }

  /* ---------------- 受付終了 ---------------- */
  if (closed) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center">
        <p className="text-4xl">🔴</p>
        <p className="text-xl font-bold text-gray-700">
          {orderedVia === "today" ? "本日の受付は終了しました" : "明日の受付は終了しました"}
        </p>
        <Button type="button" variant="muted" size="lg" className="mt-4 w-full" onClick={() => router.push("/")}>
          トップへ戻る
        </Button>
      </div>
    );
  }

  /* ---------------- 注文フォーム ---------------- */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <LiffLink name={name} />

      <Card className="border-2 border-accent/25 bg-accent-soft text-sm leading-relaxed text-accent-dark">
        {cutoffNotice.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </Card>

      <div>
        <FieldLabel>名前</FieldLabel>
        {name && !editingName ? (
          <div className="flex items-center justify-between rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-4">
            <span className="text-lg font-bold text-gray-800">{name}</span>
            <Button type="button" variant="muted" size="sm" onClick={() => setEditingName(true)}>
              変更
            </Button>
          </div>
        ) : (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="names-list"
              placeholder="名前を選ぶか、新しく入力してください"
              maxLength={20}
              required
              className="text-lg"
            />
            <datalist id="names-list">
              {names.map((n) => (
                <option key={n.id} value={n.name} />
              ))}
            </datalist>
            <HelpText>入力した名前はこの端末に保存され、次回から自動で入ります。</HelpText>
          </>
        )}
      </div>

      <div>
        <FieldLabel>{orderedVia === "today" ? "今日のメニュー" : "明日のメニュー"}</FieldLabel>
        <Select value={menuItem} onChange={(e) => setMenuItem(e.target.value)} required className="text-lg">
          <option value="">選択してください</option>
          {menuItems.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}（{yen(m.price ?? 0)}）
            </option>
          ))}
        </Select>

        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base">
          <input
            type="checkbox"
            checked={isLarge}
            onChange={(e) => setIsLarge(e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          大盛りにする（+{yen(largeExtraPrice)}）
        </label>

        {selectedMenu && (
          <p className="mt-3 rounded-xl bg-brand-light px-4 py-3 text-right text-base font-bold text-brand-dark">
            合計 {yen(estimatedTotal)}
          </p>
        )}
      </div>

      <div>
        <FieldLabel>{orderedVia === "tomorrow" ? "支払いガイド" : "支払い方法"}</FieldLabel>
        {orderedVia === "tomorrow" ? (
          <div className="overflow-hidden rounded-xl border-2 border-brand bg-brand-light">
            <div className="grid grid-cols-[28px_1fr] gap-x-3 gap-y-3 p-4">
              <span className="text-xl leading-none">🗓️</span>
              <span className="text-base text-brand-dark">
                <b className="font-bold">いつ</b>：本日中（{cutoffLabel}まで）
              </span>
              <span className="text-xl leading-none">👤</span>
              <span className="text-base text-brand-dark">
                <b className="font-bold">だれに</b>：担当の{adminName}さんへ
              </span>
              <span className="text-xl leading-none">💴</span>
              <span className="text-base text-brand-dark">
                <b className="font-bold">なにを</b>：現金を直接手渡し
              </span>
            </div>
            <p className="border-t border-brand/20 bg-white/50 px-4 py-2.5 text-xs text-brand-dark">
              ⚠️ 当日の朝の集金はありません。必ず本日中に手渡ししてください。
            </p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-brand bg-brand-light px-4 py-4 text-lg font-semibold text-brand-dark">
            {PAYMENT_METHOD}（{adminName}さんへ）
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

      <Button type="submit" variant="accent" size="lg" disabled={!canSubmit} className="mt-2">
        {submitting ? "送信中..." : myOrder ? "この内容に変更する" : "注文する"}
      </Button>

      {myOrder && (
        <Button type="button" variant="muted" onClick={() => setPhase("done")}>
          変更をやめる
        </Button>
      )}
    </form>
  );
}
