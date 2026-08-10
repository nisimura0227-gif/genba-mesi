import Link from "next/link";
import { getSettings } from "@/lib/store";
import { formatCutoffLabel } from "@/lib/date";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, FieldLabel } from "@/components/ui/Field";
import { buttonVariants } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

/** 番号つきの丸バッジ。手順の横に置いて「これが何番目か」を一目で分かるようにする。 */
function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-darker text-sm font-extrabold text-white">
      {n}
    </span>
  );
}

/** 手順1つ分。左に番号、右上に短い説明、下に「本物と同じ部品」で作った操作イメージ。 */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepNumber n={n} />
        <div className="mt-1 w-px flex-1 bg-gray-200" />
      </div>
      <div className="flex-1 pb-6">
        <p className="mb-2 text-base font-bold text-gray-800">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default async function GuidePage() {
  const settings = await getSettings();
  const todayCutoff = formatCutoffLabel(settings.cutoffHour, settings.cutoffMinute);
  const tomorrowCutoff = formatCutoffLabel(settings.tomorrowCutoffHour, settings.tomorrowCutoffMinute);

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-4">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm active:bg-gray-100"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-dark">📖 現場めしの使い方</h1>
          <p className="text-xs text-gray-500">注文方法・支払い・よくある質問</p>
        </div>
      </header>

      {/* ------------- 目次 ------------- */}
      <Card className="mb-8 flex flex-col gap-2 text-sm">
        <a href="#how-to" className="font-bold text-brand-dark active:opacity-70">
          🍱 注文方法（6ステップ）
        </a>
        <a href="#payment" className="font-bold text-brand-dark active:opacity-70">
          💰 支払いの流れ
        </a>
        <a href="#help" className="font-bold text-brand-dark active:opacity-70">
          📞 よくある質問・困ったとき
        </a>
      </Card>

      {/* ------------- 注文方法 ------------- */}
      <section id="how-to" className="mb-10 scroll-mt-4">
        <h2 className="mb-4 text-base font-bold text-brand-dark">🍱 注文方法</h2>

        <Step n={1} title="LINEの下のメニューから「🍱 弁当を注文」をタップ">
          <div className="flex w-full max-w-[220px] items-center gap-2 rounded-xl bg-brand-darker px-4 py-3 text-white shadow-card">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-base">
              🍱
            </span>
            <span className="text-sm font-extrabold">弁当を注文</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">※公式LINEのトーク画面下部にあるメニューのイメージです</p>
        </Step>

        <Step n={2} title="自分の名前を選択（初めての方は入力）">
          <div className="pointer-events-none max-w-sm">
            <FieldLabel>名前</FieldLabel>
            <Input defaultValue="山田太郎" readOnly className="text-lg" />
            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
              一度入力すればこの端末に覚えるので、次回からは選ぶだけです。
            </p>
          </div>
        </Step>

        <Step n={3} title="今日または明日の弁当を選択">
          <div className="pointer-events-none max-w-sm">
            <FieldLabel>今日のメニュー</FieldLabel>
            <Select defaultValue="唐揚げ弁当" className="text-lg">
              <option>唐揚げ弁当（¥500）</option>
            </Select>
          </div>
        </Step>

        <Step n={4} title="大盛りにしたい場合はチェック">
          <div className="pointer-events-none max-w-sm">
            <label className="flex items-center gap-3 rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base">
              <input type="checkbox" defaultChecked readOnly className="h-5 w-5 accent-brand" />
              大盛りにする（+¥100）
            </label>
          </div>
        </Step>

        <Step n={5} title="金額を確認">
          <div className="pointer-events-none max-w-sm">
            <p className="rounded-xl bg-brand-light px-4 py-3 text-right text-base font-bold text-brand-dark">
              合計 ¥600
            </p>
          </div>
        </Step>

        <Step n={6} title="「注文する」を押して確定">
          <div className="pointer-events-none max-w-sm">
            <span className={buttonVariants("accent", "lg", "w-full")}>注文する</span>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              画面が「✅ 注文は完了しています」に変わったら注文成立です。同じ名前をもう一度選ぶと、いつでも今の注文内容を確認できます。
            </p>
          </div>
        </Step>
      </section>

      {/* ------------- 支払いの流れ ------------- */}
      <section id="payment" className="mb-10 scroll-mt-4">
        <h2 className="mb-4 text-base font-bold text-brand-dark">💰 支払いの流れ</h2>

        <Card className="mb-4">
          <p className="mb-3 text-sm font-bold text-brand-dark">🍱 今日の弁当を注文した場合</p>
          <ol className="flex flex-col gap-2.5 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <Badge variant="neutral">1</Badge> 担当者へ現金を手渡しする
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="neutral">2</Badge> 自分で「💰 支払いました」を押す
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="neutral">3</Badge> 担当者が受け取りを確認する
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="success">✅</Badge> <span className="font-bold text-brand-dark">支払い済み</span>になる
            </li>
          </ol>
        </Card>

        <Card className="border-2 border-accent/30 bg-accent-soft">
          <p className="mb-3 text-sm font-bold text-accent-dark">📅 明日の弁当を注文した場合（前日払い）</p>
          <ol className="flex flex-col gap-2.5 text-sm text-accent-dark">
            <li className="flex items-center gap-2">
              <Badge variant="warning">1</Badge> 本日{tomorrowCutoff}までに注文する
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="warning">2</Badge>{" "}
              <span className="font-bold">本日中に</span> 担当者へ現金を手渡しする（当日朝の集金はなし）
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="warning">3</Badge> 自分で「💰 支払いました」を押す
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="warning">4</Badge> 担当者が受け取りを確認する
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="success">✅</Badge> <span className="font-bold">支払い済み</span>になる
            </li>
          </ol>
          <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-accent-dark">
            ⚠️ 「支払いました」を押しただけでは支払い済みになりません。担当者が実際に現金を受け取って確認するまでは「申告済み（確認待ち）」の表示のままです。
          </p>
        </Card>
      </section>

      {/* ------------- よくある質問 ------------- */}
      <section id="help" className="mb-8 scroll-mt-4">
        <h2 className="mb-4 text-base font-bold text-brand-dark">📞 よくある質問・困ったとき</h2>

        <Card className="mb-3 divide-y divide-gray-100 p-0">
          <FaqItem q="注文できたかどうか分からない">
            もう一度LINEの「🍱 弁当を注文」から同じ画面を開いてください。「✅ 注文は完了しています」と表示されれば、注文はきちんと届いています。
          </FaqItem>
          <FaqItem q="明日の注文って、いつ払うの？">
            <span className="font-bold text-brand-dark">当日中</span>に払います。明日食べる分でも、支払いは前日（本日{tomorrowCutoff}まで）に済ませます。当日の朝の集金はありません。
          </FaqItem>
          <FaqItem q="今日の注文の締切は？">
            {todayCutoff}までです。それを過ぎると、その日の注文はできなくなります。
          </FaqItem>
          <FaqItem q="注文を間違えた・変更したい">
            締切前であれば、注文完了画面の「✏️ 注文内容を変更する」からいつでも変更できます。
          </FaqItem>
          <FaqItem q="注文をやめたい（キャンセルしたい）">
            締切前かつ支払い前であれば、注文完了画面の「❌ 注文をキャンセルする」からキャンセルできます。「支払いました」を押した後・支払い済みの後は、ご自身でのキャンセルはできません。担当者へ直接ご連絡ください。
          </FaqItem>
          <FaqItem q="自分と同じ名前の人がいる">
            すでに同じ名前で注文がある状態で送信すると、「ご本人の注文変更ですか？」という確認が出ます。別人の場合は「キャンセル」を選び、「山田太郎(A班)」のように区別できる名前にしてください。
          </FaqItem>
          <FaqItem q="LINEに通知が来ない">
            通知には、公式LINEの「🍱 弁当を注文」からサイトを開いた状態でのご利用登録が必要です。ブックマークや他のアプリから直接サイトを開いた場合は届きません。
          </FaqItem>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600">
            解決しない場合は、担当の
            <span className="font-bold text-brand-dark">{settings.adminName}</span>さんへ直接ご連絡ください。
          </p>
        </Card>
      </section>

      <Link href="/" className={buttonVariants("primary", "lg", "w-full")}>
        トップへ戻って注文する
      </Link>
    </main>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group px-4 py-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-gray-800">
        <span>Q. {q}</span>
        <span className="flex-shrink-0 text-gray-300 transition-transform group-open:rotate-45">＋</span>
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{children}</p>
    </details>
  );
}
