import { listNames, listOrdersByDate, listLineLinks } from "@/lib/store";
import { todayStr, tomorrowStr } from "@/lib/date";
import ManageList from "@/components/ManageList";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function formatOrder(menuItem?: string, isLarge?: boolean): string {
  if (!menuItem) return "－";
  return `${menuItem}${isLarge ? "（大盛り）" : ""}`;
}

function lineKey(name: string): string {
  return name.trim().toLowerCase();
}

export default async function AdminNamesPage() {
  const [names, todayOrders, tomorrowOrders, lineLinks] = await Promise.all([
    listNames(),
    listOrdersByDate(todayStr()),
    listOrdersByDate(tomorrowStr()),
    listLineLinks(),
  ]);

  const todayMap = new Map(todayOrders.map((o) => [o.name, o]));
  const tomorrowMap = new Map(tomorrowOrders.map((o) => [o.name, o]));
  const linkedNames = new Set(lineLinks.map((l) => lineKey(l.name)));
  const linkedCount = names.filter((n) => linkedNames.has(lineKey(n.name))).length;

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-dark">👀 登録されている名前と注文状況</h2>
          {names.length > 0 && (
            <span className="text-xs text-gray-500">
              LINE連携 {linkedCount}/{names.length}人
            </span>
          )}
        </div>
        {names.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-gray-400">
            まだ誰も登録していません。注文フォームから名前を入力すると自動で登録されます。
          </Card>
        ) : (
          <Card className="divide-y divide-gray-100 p-0">
            {names.map((n) => {
              const t = todayMap.get(n.name);
              const m = tomorrowMap.get(n.name);
              const linked = linkedNames.has(lineKey(n.name));
              return (
                <div key={n.id} className="px-3.5 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-base font-bold text-gray-800">{n.name}</p>
                    {linked ? (
                      <Badge variant="success">✅ LINE連携済み</Badge>
                    ) : (
                      <Badge variant="neutral">未連携</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    今日：{formatOrder(t?.menuItem, t?.isLarge)}
                    {t ? `（${t.paymentMethod}）` : ""}
                    {t?.paymentStatus === "paid" ? " ✅支払い済み" : t?.paymentStatus === "claimed" ? " 🙋申告済み" : ""}
                  </p>
                  <p className="text-xs text-gray-500">明日：{formatOrder(m?.menuItem, m?.isLarge)}</p>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <ManageList apiBase="/api/names" title="👤 名前の追加・削除" itemLabel="名前" addPlaceholder="例）山田太郎" />
    </div>
  );
}
