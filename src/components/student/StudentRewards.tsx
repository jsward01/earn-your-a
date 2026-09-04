import { useState } from "react";
import type { SavingsGoal } from "../../types";
import { PAYOUT_HISTORY, WEEKLY_HISTORY } from "../../data/mockData";
import { getSubjectLight } from "../../lib/styles";

interface StudentRewardsProps {
  payoutPending: boolean;
  setPayoutPending: (pending: boolean) => void;
}

export function StudentRewards({ payoutPending, setPayoutPending }: StudentRewardsProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goal, setGoal] = useState<SavingsGoal>({ name: "New Jordans 👟", amount: 120 });
  const [goalDraft, setGoalDraft] = useState({ name: "", amount: "" });
  const [requested, setRequested] = useState(false);
  const balance = 23;
  const holdback = 20;
  const available = Math.max(0, balance - holdback);
  const goalProgress = Math.min(100, Math.round((84 / goal.amount) * 100));

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 text-white shadow-lg">
        <p className="text-indigo-200 text-sm">Current Balance</p>
        <p className="text-4xl font-bold mt-1">${balance.toFixed(2)}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <div><p className="text-indigo-300 text-xs">Holdback</p><p className="font-semibold text-yellow-300">-${holdback}.00</p></div>
          <div><p className="text-indigo-300 text-xs">Available</p><p className="font-semibold text-green-300">${available}.00</p></div>
        </div>
        {payoutPending
          ? <div className="mt-4 w-full bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-2xl text-sm text-center">⏳ Payout Pending Parent Approval</div>
          : <button onClick={() => setShowPayoutModal(true)} disabled={available <= 0} className="mt-4 w-full bg-white text-indigo-600 font-bold py-2.5 rounded-2xl text-sm disabled:opacity-40">💸 Request Payout</button>
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
        {PAYOUT_HISTORY.map((p, i) => (
          <div key={i} className="flex justify-between items-center mb-2">
            <div><p className="text-sm font-semibold text-gray-700">{p.date}</p><p className="text-xs text-gray-400">{p.method}</p></div>
            <div className="text-right"><p className="font-bold text-green-600">+${p.amount}</p><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span></div>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2 px-1">WEEKLY HISTORY</p>
        {WEEKLY_HISTORY.map((w, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
            <button onClick={() => setExpandedWeek(expandedWeek === i ? null : i)} className="w-full flex items-center justify-between p-4">
              <div className="text-left"><p className="font-semibold text-gray-700 text-sm">{w.week}</p><p className="text-xs text-gray-400">{w.items.length} assignments</p></div>
              <div className="flex items-center gap-3"><p className={`font-bold ${w.net >= 0 ? "text-green-600" : "text-red-500"}`}>{w.net >= 0 ? "+" : ""}${w.net}</p><span className="text-gray-400 text-sm">{expandedWeek === i ? "▲" : "▼"}</span></div>
            </button>
            {expandedWeek === i && <div className="border-t border-gray-100 divide-y divide-gray-50">
              {w.items.map((item, j) => (
                <div key={j} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(item.subject)}`}>{item.subject}</span><p className="text-sm text-gray-600">{item.title}</p></div>
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
                <div className="flex justify-between text-sm"><span>Balance</span><span className="font-bold">${balance}</span></div>
                <div className="flex justify-between text-sm"><span>Holdback</span><span className="font-bold text-yellow-600">-${holdback}</span></div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm"><span className="font-bold">Requesting</span><span className="font-bold text-green-600">${available}</span></div>
              </div>
              <p className="text-xs text-gray-400">A $20 buffer is held back to cover any upcoming penalties. Negative balances carry forward.</p>
              <button onClick={() => { setRequested(true); setPayoutPending(true); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">Send Request to Parent</button>
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
            <button onClick={() => { setGoal({ name: goalDraft.name, amount: parseFloat(goalDraft.amount) }); setShowGoalModal(false); }} disabled={!goalDraft.name || !goalDraft.amount} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Save Goal</button>
            <button onClick={() => setShowGoalModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
