import { useEffect, useState } from "react";
import type { Assignment, PayoutAction } from "../../types";
import { getSubjectColor, getSubjectLight, getDaysLeftColor } from "../../lib/styles";
import { fetchPayouts, resolvePayout, type PayoutRequestRow, type RewardSummary } from "../../lib/api";
import { rewardAmountFor } from "../../lib/rewards";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { daysUntilDate } from "../../lib/dates";
import { splitPending } from "../../lib/assignments";

interface ParentOverviewProps {
  assignments: Assignment[];
  summary: RewardSummary | null;
  onChanged: () => void;
  /** Open the parent editor for this assignment (to grade it, fix a grade, or change its details). */
  onEdit: (a: Assignment) => void;
  /** Open the parent editor empty, to add an assignment (with or without a grade). */
  onAdd: () => void;
}

function getDueSoonColor(date: string): string {
  const days = daysUntilDate(date);
  if (days <= 1) return "border-red-300 bg-red-50";
  if (days <= 3) return "border-yellow-300 bg-yellow-50";
  return "border-gray-200 bg-white";
}

function getDueSoonLabel(date: string): { text: string; color: string } {
  const days = daysUntilDate(date);
  if (days === 0) return { text: "Due Today", color: "text-red-600 font-bold" };
  if (days === 1) return { text: "Due Tomorrow", color: "text-red-500 font-bold" };
  if (days <= 3) return { text: `Due in ${days} days`, color: "text-yellow-600 font-semibold" };
  return { text: `Due ${date}`, color: "text-gray-400" };
}

function getWaitingLabel(date: string): string {
  const days = -daysUntilDate(date);
  return days === 1 ? "Was due yesterday" : `Was due ${days} days ago`;
}

type OverviewFilter = "all" | "toGrade" | "comingUp" | "missing" | "lowGrade";

export function ParentOverview({ assignments, summary, onChanged, onEdit, onAdd }: ParentOverviewProps) {
  const rules = useRewardSettings();
  const fmt = useFormatAmount();
  const [filter, setFilter] = useState<OverviewFilter>("all");
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAction, setPayoutAction] = useState<PayoutAction | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);
  const [resolving, setResolving] = useState(false);
  const payoutPending = summary?.payoutPending ?? false;
  const pending = payouts.find(p => p.status === "pending");

  useEffect(() => {
    fetchPayouts().then(setPayouts).catch(err => console.error("Failed to load payouts", err));
  }, [summary]);

  async function handleResolve(action: "approve" | "deny") {
    if (!pending) return;
    setResolving(true);
    try {
      await resolvePayout(pending.id, action);
      onChanged();
      setShowPayoutModal(false);
    } catch (err) {
      console.error("Failed to resolve payout", err);
    } finally {
      setResolving(false);
    }
  }

  // Pending work splits in two: past due = waiting on the parent's grade, everything else is still coming up.
  const { needsGrade, comingUp: upcoming } = splitPending(assignments);

  // Work already settled by a payout is archived (Past Grades), so it drops off these to-do style lists.
  const missing = assignments.filter(a => a.status === "missing" && !a.payoutId);
  const lowGrade = assignments.filter(a => a.status === "graded" && a.grade !== null && a.grade < rules.passingThreshold && !a.payoutId);

  const show = (f: Exclude<OverviewFilter, "all">) => filter === "all" || filter === f;

  const graded = assignments.filter(a => a.grade !== null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length) : 0;

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">

      {payoutPending && pending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💸</span>
            <div><p className="font-bold text-yellow-800">Payout Request from {summary?.studentName ?? "your student"}</p><p className="text-xs text-yellow-600">Requesting {fmt(pending.amount)} • Submitted {new Date(pending.requestedAt).toLocaleString()}</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPayoutAction("approve"); setShowPayoutModal(true); }} className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-bold">✅ Approve</button>
            <button onClick={() => { setPayoutAction("delay"); setShowPayoutModal(true); }} className="flex-1 bg-yellow-400 text-yellow-900 py-2 rounded-xl text-sm font-bold">⏰ Delay</button>
            <button onClick={() => { setPayoutAction("deny"); setShowPayoutModal(true); }} className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-sm font-bold">❌ Deny</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setFilter("all")} aria-pressed={filter === "all"}
          className={`text-sm font-semibold px-4 py-2 rounded-lg border ${filter === "all" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-200"}`}>All</button>
        <button onClick={onAdd} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-2 rounded-lg">+ Add assignment</button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {([
          { key: "toGrade", label: "To Grade", val: needsGrade.length, color: needsGrade.length > 0 ? "text-amber-600" : "text-green-600", bg: needsGrade.length > 0 ? "bg-amber-50" : "bg-green-50" },
          { key: "comingUp", label: "Coming Up", val: upcoming.length, color: "text-indigo-600", bg: "bg-indigo-50" },
          { key: "missing", label: "Missing", val: missing.length, color: missing.length > 0 ? "text-red-500" : "text-green-600", bg: missing.length > 0 ? "bg-red-50" : "bg-green-50" },
          { key: "lowGrade", label: "Low Grade", val: lowGrade.length, color: lowGrade.length > 0 ? "text-orange-500" : "text-green-600", bg: lowGrade.length > 0 ? "bg-orange-50" : "bg-green-50" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFilter(filter === t.key ? "all" : t.key)} aria-pressed={filter === t.key}
            className={`${t.bg} rounded-2xl p-2 shadow-sm text-center border active:opacity-80 ${filter === t.key ? "border-emerald-700 ring-2 ring-emerald-700" : "border-gray-100"}`}>
            <p className={`text-xl font-bold ${t.color}`}>{t.val}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.label}</p>
          </button>
        ))}
      </div>

      {graded.length > 0 && (
        <p className="text-xs text-gray-400 text-center -mt-2">
          Overall average {avgGrade}% across {graded.length} graded {graded.length === 1 ? "item" : "items"} (all classes; Campus weights each class differently)
        </p>
      )}

      {/* SECTION 0: Needs your grade (past due, still ungraded) */}
      {show("toGrade") && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">✏️</span>
            <p className="font-bold text-gray-800 text-sm">Needs Your Grade</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${needsGrade.length > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{needsGrade.length}</span>
        </div>
        {needsGrade.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">Nothing waiting on you 🎉</p>
          : <div className="divide-y divide-gray-50">
            {needsGrade.map(a => (
              <div key={a.id} onClick={() => onEdit(a)} className="flex items-center justify-between px-4 py-3 border-l-4 border-amber-400 bg-amber-50 cursor-pointer active:opacity-80">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                      <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-amber-700 font-semibold">{getWaitingLabel(a.dueDate)}</p>
                  <p className="text-xs text-indigo-500 font-semibold mt-0.5">{fmt(rewardAmountFor(a.type, rules), { short: true })} at stake</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
      )}

      {/* SECTION 1: Coming up (not yet due) */}
      {show("comingUp") && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <p className="font-bold text-gray-800 text-sm">Coming Up</p>
          </div>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcoming.length}</span>
        </div>
        {upcoming.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No upcoming assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {upcoming.map(a => {
              const due = getDueSoonLabel(a.dueDate);
              return (
                <div key={a.id} onClick={() => onEdit(a)} className={`flex items-center justify-between px-4 py-3 border-l-4 cursor-pointer active:opacity-80 ${getDueSoonColor(a.dueDate)}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-xs ${due.color}`}>{due.text}</p>
                    <p className="text-xs text-indigo-500 font-semibold mt-0.5">{fmt(rewardAmountFor(a.type, rules), { short: true })} potential</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
      )}

      {/* SECTION 2: Missing Assignments */}
      {show("missing") && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <p className="font-bold text-gray-800 text-sm">Missing Assignments</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${missing.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{missing.length}</span>
        </div>
        {missing.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No missing assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {missing.map(a => (
              <div key={a.id} onClick={() => onEdit(a)} className="flex items-center justify-between px-4 py-3 border-l-4 border-red-400 bg-red-50 cursor-pointer active:opacity-80">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                      {(a.daysLeft ?? 0) > 0 && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft ?? 0)}`}>⏱ {a.daysLeft}d to fix</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-red-500 font-bold">{fmt(0)}</p>
                  <p className="text-xs text-gray-400">was {fmt(rewardAmountFor(a.type, rules), { short: true })}</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
      )}

      {/* SECTION 3: Low Grade Assignments */}
      {show("lowGrade") && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📉</span>
            <p className="font-bold text-gray-800 text-sm">Low Grade Assignments</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lowGrade.length > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>{lowGrade.length}</span>
        </div>
        {lowGrade.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No low grade assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {lowGrade.map(a => {
              const canMakeup = (a.type === "test" || a.type === "quiz") && (a.daysLeft ?? 0) > 0;
              return (
                <div key={a.id} onClick={() => onEdit(a)} className="flex items-center justify-between px-4 py-3 border-l-4 border-orange-400 bg-orange-50 cursor-pointer active:opacity-80">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                        {canMakeup && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft ?? 0)}`}>⏱ {a.daysLeft}d to retake</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xl font-bold text-orange-600">{a.grade}%</p>
                    {canMakeup
                      ? <p className="text-xs text-green-600 font-semibold">Retake available</p>
                      : <p className="text-xs text-red-400">No retake</p>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
      )}

      {showPayoutModal && pending && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl p-6 space-y-4">
            {payoutAction === "approve" && <>
              <h2 className="text-lg font-bold text-gray-800">✅ Approve Payout</h2>
              <div className="bg-green-50 rounded-2xl p-4">
                <div className="flex justify-between text-sm mb-2"><span>Amount</span><span className="font-bold text-green-600">{fmt(pending.amount)}</span></div>
                <div className="flex justify-between text-sm"><span>Holdback retained</span><span className="font-bold">{fmt(pending.holdbackAmount)}</span></div>
              </div>
              <p className="text-sm text-gray-500">Confirming records the payout and locks the paid work under Past Grades. It does <span className="font-semibold">not</span> send anything — pay {summary?.studentName ?? "your student"} {fmt(pending.amount)} yourself (Venmo, cash, etc.).</p>
              <button onClick={() => handleResolve("approve")} disabled={resolving} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold disabled:opacity-40">{resolving ? "Confirming…" : "Confirm Approval"}</button>
            </>}
            {payoutAction === "delay" && <>
              <h2 className="text-lg font-bold text-gray-800">⏰ Delay Payout</h2>
              <p className="text-sm text-gray-500">The request stays pending — {summary?.studentName ?? "your student"} will see it's still awaiting your approval.</p>
              <button onClick={() => setShowPayoutModal(false)} className="w-full bg-yellow-100 text-yellow-800 py-3 rounded-xl text-sm font-semibold">Okay, I'll pay soon</button>
            </>}
            {payoutAction === "deny" && <>
              <h2 className="text-lg font-bold text-gray-800">❌ Deny Payout</h2>
              <p className="text-sm text-gray-500">{summary?.studentName ?? "Your student"} will be notified the payout was denied and the balance will remain.</p>
              <button onClick={() => handleResolve("deny")} disabled={resolving} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold disabled:opacity-40">{resolving ? "Confirming…" : "Confirm Denial"}</button>
            </>}
            <button onClick={() => setShowPayoutModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
