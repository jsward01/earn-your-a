import { useEffect, useState } from "react";
import type { Assignment } from "../../types";
import { fetchPayouts, type PayoutRequestRow, type RewardSummary } from "../../lib/api";
import { getRewardStatus } from "../../lib/rewards";
import { useRewardSettings } from "../../lib/rewardSettingsContext";
import { plainMoney, shortDate, signedMoney } from "../../lib/money";
import { getSubjectLight } from "../../lib/styles";

interface BalancePageProps {
  assignments: Assignment[];
  summary: RewardSummary | null;
  /** Students see their grades but can't change them; parents can tap a current grade to edit it. */
  readOnly: boolean;
  onBack: () => void;
  onEdit: (a: Assignment) => void;
  onAdd: () => void;
}

type Tab = "current" | "past";

const byDueDesc = (a: Assignment, b: Assignment) => b.dueDate.localeCompare(a.dueDate);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function BalancePage({ assignments, summary, readOnly, onBack, onEdit, onAdd }: BalancePageProps) {
  const rules = useRewardSettings();
  const [tab, setTab] = useState<Tab>("current");
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);

  useEffect(() => {
    fetchPayouts().then(setPayouts).catch(err => console.error("Failed to load payouts", err));
  }, []);

  // "Current" = finished work that hasn't been settled by a payout yet (graded or missing; pending work has no grade to show).
  const current = assignments.filter(a => a.status !== "pending" && !a.payoutId).sort(byDueDesc);
  const currentTotal = round2(current.reduce((s, a) => s + (a.recordedReward ?? 0), 0));
  const balance = summary?.balance ?? 0;
  // Whatever the balance holds beyond the current list: money earned in earlier periods but not paid out (the holdback), or a carried-forward negative.
  const carriedOver = round2(balance - currentTotal);

  const settled = assignments.filter(a => a.payoutId);
  const groups = [...new Set(settled.map(a => a.payoutId as string))]
    .map(id => {
      const items = settled.filter(a => a.payoutId === id).sort(byDueDesc);
      return {
        id,
        paidAt: items[0]?.paidAt ?? null,
        paid: payouts.find(p => p.id === id)?.amount ?? null,
        items,
        total: round2(items.reduce((s, a) => s + (a.recordedReward ?? 0), 0)),
      };
    })
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));

  function row(a: Assignment, editable: boolean) {
    const r = getRewardStatus(a, rules);
    const body = (
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-left w-full">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
            <span className="text-xs text-gray-400 capitalize">{a.type}</span>
            <span className="text-xs text-gray-400">Due {a.dueDate}</span>
            {a.makeupAvailable && (a.daysLeft ?? 0) > 0 && <span className="text-xs px-2 py-0.5 rounded-full border border-orange-200 text-orange-600 font-medium">⏱ {a.daysLeft}d to retake</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${r.color}`}>{r.label}</p>
          <p className="text-xs text-gray-400">{a.status === "missing" ? "$0.00" : a.grade !== null ? `${a.grade}%` : "—"}</p>
        </div>
      </div>
    );
    return editable
      ? <button key={a.id} onClick={() => onEdit(a)} className="w-full active:bg-gray-50 block">{body}</button>
      : <div key={a.id}>{body}</div>;
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-indigo-600 font-medium">‹ Back</button>
        {!readOnly && <button onClick={onAdd} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-lg">+ Add graded work</button>}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400 font-medium">{summary?.studentName ? `${summary.studentName.toUpperCase()}'S BALANCE` : "BALANCE"}</p>
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-500"}`}>{plainMoney(balance)}</p>
        <p className="text-xs text-gray-400 mt-1">
          {readOnly
            ? "Grades stay open until they're paid out. If something looks wrong, ask a parent."
            : "Tap a grade to edit it — the balance updates as you save. Grades lock once they're paid out."}
        </p>
      </div>

      <div className="flex gap-2">
        {(["current", "past"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${tab === t ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200"}`}>
            {t === "current" ? `Current Grades (${current.length})` : "Past Grades"}
          </button>
        ))}
      </div>

      {tab === "current" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {carriedOver !== 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-700">Carried over</p>
                <p className="text-xs text-gray-400">Earned in earlier periods, not paid out yet (the holdback)</p>
              </div>
              <p className={`text-sm font-bold ${carriedOver >= 0 ? "text-green-600" : "text-red-500"}`}>{signedMoney(carriedOver)}</p>
            </div>
          )}
          {current.map(a => row(a, !readOnly))}
          {current.length === 0 && <p className="text-sm text-gray-400 px-4 py-6 text-center">No grades since the last payout.</p>}
          {current.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">This period</p>
              <p className={`text-sm font-bold ${currentTotal >= 0 ? "text-green-600" : "text-red-500"}`}>{signedMoney(currentTotal)}</p>
            </div>
          )}
        </div>
      )}

      {tab === "past" && (
        <div className="space-y-4">
          {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nothing here yet. Grades move here after a payout.</p>}
          {groups.map(g => (
            <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700">🔒 Paid {g.paidAt ? shortDate(g.paidAt) : ""}</p>
                <p className="text-sm font-bold text-gray-700">{g.paid !== null ? plainMoney(g.paid) : ""}</p>
              </div>
              <div className="divide-y divide-gray-50">{g.items.map(a => row(a, false))}</div>
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">Grades in this period</p>
                <p className="text-xs font-semibold text-gray-500">{signedMoney(g.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
