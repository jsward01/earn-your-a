import { useEffect, useState } from "react";
import type { SavingsGoal } from "../../types";
import {
  fetchPayouts,
  fetchRewardTransactions,
  fetchSavingsGoal,
  requestPayout,
  saveSavingsGoal,
  type PayoutRequestRow,
  type RewardSummary,
  type RewardTransaction,
} from "../../lib/api";
import { getSubjectLight } from "../../lib/styles";

interface StudentRewardsProps {
  summary: RewardSummary | null;
  onChanged: () => void;
}

const DEFAULT_GOAL: SavingsGoal = { name: "New Jordans 👟", amount: 120 };
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Week {
  key: string;
  label: string;
  net: number;
  items: RewardTransaction[];
}

function groupByWeek(transactions: RewardTransaction[]): Week[] {
  const assignmentTx = transactions.filter(t => t.subject !== null);
  const weeks = new Map<string, Week>();

  for (const t of assignmentTx) {
    const d = new Date(t.createdAt);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const key = start.toISOString().slice(0, 10);
    const label = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()} – ${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;

    if (!weeks.has(key)) weeks.set(key, { key, label, net: 0, items: [] });
    const week = weeks.get(key)!;
    week.net += t.amount;
    week.items.push(t);
  }

  return [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function StudentRewards({ summary, onChanged }: StudentRewardsProps) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);
  const [goal, setGoal] = useState<SavingsGoal>(DEFAULT_GOAL);
  const [goalDraft, setGoalDraft] = useState({ name: "", amount: "" });
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const balance = summary?.balance ?? 0;
  const holdback = summary?.holdback ?? 0;
  const available = summary?.available ?? 0;
  const payoutPending = summary?.payoutPending ?? false;
  const goalProgress = goal.amount > 0 ? Math.min(100, Math.round((balance / goal.amount) * 100)) : 0;
  const weeks = groupByWeek(transactions);
  const payoutHistory = payouts.filter(p => p.status !== "pending");

  useEffect(() => {
    fetchRewardTransactions().then(setTransactions).catch(err => console.error("Failed to load transactions", err));
    fetchSavingsGoal().then(g => setGoal(g ?? DEFAULT_GOAL)).catch(err => console.error("Failed to load savings goal", err));
  }, []);

  useEffect(() => {
    fetchPayouts().then(setPayouts).catch(err => console.error("Failed to load payouts", err));
  }, [summary]);

  async function handleRequestPayout() {
    setRequesting(true);
    try {
      await requestPayout();
      onChanged();
      setRequested(true);
    } catch (err) {
      console.error("Failed to request payout", err);
    } finally {
      setRequesting(false);
    }
  }

  async function handleSaveGoal() {
    setSavingGoal(true);
    try {
      const saved = await saveSavingsGoal({ name: goalDraft.name, amount: parseFloat(goalDraft.amount) });
      setGoal(saved);
      setShowGoalModal(false);
    } catch (err) {
      console.error("Failed to save savings goal", err);
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 text-white shadow-lg">
        <p className="text-indigo-200 text-sm">Current Balance</p>
        <p className="text-4xl font-bold mt-1">${balance.toFixed(2)}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <div><p className="text-indigo-300 text-xs">Holdback</p><p className="font-semibold text-yellow-300">-${holdback.toFixed(2)}</p></div>
          <div><p className="text-indigo-300 text-xs">Available</p><p className="font-semibold text-green-300">${available.toFixed(2)}</p></div>
        </div>
        {payoutPending
          ? <div className="mt-4 w-full bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-2xl text-sm text-center">⏳ Payout Pending Parent Approval</div>
          : <button onClick={() => { setRequested(false); setShowPayoutModal(true); }} disabled={available <= 0} className="mt-4 w-full bg-white text-indigo-600 font-bold py-2.5 rounded-2xl text-sm disabled:opacity-40">💸 Request Payout</button>
        }
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between mb-3">
          <div><p className="text-xs text-gray-400 font-medium">SAVINGS GOAL</p><p className="font-bold text-gray-800">{goal.name}</p></div>
          <div className="text-right"><p className="text-xs text-gray-400">Target</p><p className="font-bold text-indigo-600">${goal.amount}</p></div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full" style={{ width: `${goalProgress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-xs text-gray-500">{goalProgress}% saved</p>
          <button onClick={() => { setGoalDraft({ name: goal.name, amount: String(goal.amount) }); setShowGoalModal(true); }} className="text-xs text-indigo-500 font-medium">Edit Goal</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-3">PAYOUT HISTORY</p>
        {payoutHistory.length === 0 && <p className="text-sm text-gray-400">No payouts yet</p>}
        {payoutHistory.map(p => (
          <div key={p.id} className="flex justify-between items-center mb-2">
            <div><p className="text-sm font-semibold text-gray-700">{new Date(p.resolvedAt ?? p.requestedAt).toLocaleDateString()}</p></div>
            {p.status === "paid"
              ? <div className="text-right"><p className="font-bold text-green-600">+${p.amount.toFixed(2)}</p><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span></div>
              : <div className="text-right"><p className="font-bold text-gray-400">${p.amount.toFixed(2)}</p><span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Denied</span></div>
            }
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2 px-1">WEEKLY HISTORY</p>
        {weeks.length === 0 && <p className="text-sm text-gray-400 px-1">No graded work yet</p>}
        {weeks.map(w => (
          <div key={w.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
            <button onClick={() => setExpandedWeek(expandedWeek === w.key ? null : w.key)} className="w-full flex items-center justify-between p-4">
              <div className="text-left"><p className="font-semibold text-gray-700 text-sm">{w.label}</p><p className="text-xs text-gray-400">{w.items.length} assignments</p></div>
              <div className="flex items-center gap-3"><p className={`font-bold ${w.net >= 0 ? "text-green-600" : "text-red-500"}`}>{w.net >= 0 ? "+" : ""}${w.net}</p><span className="text-gray-400 text-sm">{expandedWeek === w.key ? "▲" : "▼"}</span></div>
            </button>
            {expandedWeek === w.key && <div className="border-t border-gray-100 divide-y divide-gray-50">
              {w.items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(item.subject ?? "")}`}>{item.subject}</span><p className="text-sm text-gray-600">{item.reason}</p></div>
                  <p className={`text-sm font-bold ${item.amount > 0 ? "text-green-600" : item.amount < 0 ? "text-red-500" : "text-gray-400"}`}>{item.amount > 0 ? "+" : ""}${item.amount}</p>
                </div>
              ))}
            </div>}
          </div>
        ))}
      </div>
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Request Payout</h2>
            {!requested ? <>
              <div className="bg-indigo-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Balance</span><span className="font-bold">${balance.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Holdback</span><span className="font-bold text-yellow-600">-${holdback.toFixed(2)}</span></div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm"><span className="font-bold">Requesting</span><span className="font-bold text-green-600">${available.toFixed(2)}</span></div>
              </div>
              <p className="text-xs text-gray-400">A ${holdback.toFixed(2)} buffer is held back to cover any upcoming penalties. Negative balances carry forward.</p>
              <button onClick={handleRequestPayout} disabled={requesting} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">{requesting ? "Sending…" : "Send Request to Parent"}</button>
              <button onClick={() => setShowPayoutModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
            </> : <div className="text-center py-6">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-bold text-lg">Request Sent!</p>
              <p className="text-sm text-gray-500 mt-1">Your parent will review and approve.</p>
              <button onClick={() => { setShowPayoutModal(false); setRequested(false); }} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">Done</button>
            </div>}
          </div>
        </div>
      )}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Edit Savings Goal</h2>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Goal name" value={goalDraft.name} onChange={e => setGoalDraft({ ...goalDraft, name: e.target.value })} />
            <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Target amount ($)" value={goalDraft.amount} onChange={e => setGoalDraft({ ...goalDraft, amount: e.target.value })} />
            <button onClick={handleSaveGoal} disabled={!goalDraft.name || !goalDraft.amount || savingGoal} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">{savingGoal ? "Saving…" : "Save Goal"}</button>
            <button onClick={() => setShowGoalModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
