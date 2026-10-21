import { useEffect, useState } from "react";
import type { Assignment, PayoutAction } from "../../types";
import { getSubjectColor, getSubjectLight, getDaysLeftColor } from "../../lib/styles";
import { fetchClassSettings, fetchPayouts, parentPayout, resolvePayout, setTrackOnlyAlerts, type ClassSettings, type PayoutRequestRow, type RewardSummary } from "../../lib/api";
import { potentialReward } from "../../lib/rewards";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { daysUntilDate } from "../../lib/dates";
import { splitPending } from "../../lib/assignments";
import { ImportModal } from "./ImportModal";
import { ClassAverages } from "../shared/ClassAverages";
import { ClassSettingModal } from "./ClassSettingModal";
import { classKey } from "../../lib/import/normalize";

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
  const [showImport, setShowImport] = useState(false);
  // Parent-initiated payout ("Pay out now"): any time, whatever the payout schedule.
  const [payingOut, setPayingOut] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const payoutPending = summary?.payoutPending ?? false;
  const pending = payouts.find(p => p.status === "pending");

  useEffect(() => {
    fetchPayouts().then(setPayouts).catch(err => console.error("Failed to load payouts", err));
  }, [summary]);

  // Pays / Track only / Leave out per class (tags on Class Averages), and whether Track only work shows in the lists below.
  const [classSettings, setClassSettings] = useState<ClassSettings | null>(null);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const loadClassSettings = () => fetchClassSettings().then(setClassSettings).catch(err => console.error("Failed to load class settings", err));
  useEffect(() => { loadClassSettings(); }, []);
  const classModes = Object.fromEntries((classSettings?.classes ?? []).map(c => [c.classKey, c.mode]));
  const showTrackOnly = classSettings?.showTrackOnlyAlerts ?? true;

  async function toggleTrackOnlyAlerts() {
    if (!classSettings) return;
    setSavingAlerts(true);
    try {
      const show = await setTrackOnlyAlerts(!showTrackOnly);
      setClassSettings({ ...classSettings, showTrackOnlyAlerts: show });
    } catch (err) {
      console.error("Failed to save the Track only switch", err);
    } finally {
      setSavingAlerts(false);
    }
  }

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

  const balance = summary?.balance ?? 0;
  const available = summary?.available ?? 0;
  const payNumber = Number(payAmount);
  const payValid = payAmount.trim() !== "" && Number.isFinite(payNumber) && payNumber > 0 && payNumber <= balance;

  function openPayOut() {
    setPayAmount(String(available > 0 ? available : Math.max(0, balance)));
    setPayError(null);
    setPayingOut(true);
  }

  async function handlePayOut() {
    setPaySaving(true);
    setPayError(null);
    try {
      await parentPayout(Math.round(payNumber * 100) / 100);
      onChanged();
      setPayingOut(false);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Couldn't record the payout");
    } finally {
      setPaySaving(false);
    }
  }

  // Pending work splits in two: past due = waiting on the parent's grade, everything else is still coming up.
  // Work from before rewards started is on record only, so it never needs attention here (it still counts in the class averages).
  // Track only work shows (tagged "no reward") unless the parent switched that off.
  const current = assignments.filter(a => !a.historyOnly && (showTrackOnly || !a.trackOnly));
  const stake = (a: Assignment, word: string) => {
    const n = potentialReward(a, rules);
    return n === null ? "no reward" : `${fmt(n, { short: true })} ${word}`;
  };
  const { needsGrade, comingUp: upcoming } = splitPending(current);

  // Work already settled by a payout is archived (Past Grades), so it drops off these to-do style lists.
  const missing = current.filter(a => a.status === "missing" && !a.payoutId);
  const lowGrade = current.filter(a => a.status === "graded" && a.grade !== null && a.grade < rules.passingThreshold && !a.payoutId);

  const show = (f: Exclude<OverviewFilter, "all">) => filter === "all" || filter === f;

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

      {summary && !pending && balance > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{fmt(available)} ready to pay out</p>
            <p className="text-xs text-gray-400">Balance {fmt(balance)}{summary.holdback > 0 ? ` · ${fmt(summary.holdback)} held back` : ""}</p>
          </div>
          <button onClick={openPayOut} className="shrink-0 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">💸 Pay out now</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setFilter("all")} aria-pressed={filter === "all"}
          className={`text-sm font-semibold px-4 py-2 rounded-lg border ${filter === "all" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-200"}`}>All</button>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-2 rounded-lg">⇩ Import grades</button>
          <button onClick={onAdd} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-2 rounded-lg">+ Add assignment</button>
        </div>
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
                      {a.trackOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 font-medium">Track only</span>}
                      <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-amber-700 font-semibold">{getWaitingLabel(a.dueDate)}</p>
                  <p className="text-xs text-indigo-500 font-semibold mt-0.5">{stake(a, "at stake")}</p>
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
                      {a.trackOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 font-medium">Track only</span>}
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-xs ${due.color}`}>{due.text}</p>
                    <p className="text-xs text-indigo-500 font-semibold mt-0.5">{stake(a, "potential")}</p>
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
                      {a.trackOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 font-medium">Track only</span>}
                      {(a.daysLeft ?? 0) > 0 && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft ?? 0)}`}>⏱ {a.daysLeft}d to fix</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-red-500 font-bold">{fmt(0)}</p>
                  <p className="text-xs text-gray-400">{a.trackOnly ? "Track only" : `was ${fmt(potentialReward(a, rules) ?? 0, { short: true })}`}</p>
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
                      {a.trackOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 font-medium">Track only</span>}
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                        {canMakeup && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft ?? 0)}`}>⏱ {a.daysLeft}d to retake</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xl font-bold text-orange-600">{a.grade}%</p>
                    {canMakeup
                      ? <p className="text-xs text-green-600 font-semibold">Retake available</p>
                      : <p className="text-xs text-red-400">{a.trackOnly ? "No reward" : "No retake"}</p>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
      )}

      {filter === "all" && <ClassAverages assignments={assignments} classModes={classModes} onClassTap={setEditingClass} />}

      {filter === "all" && classSettings?.classes.some(c => c.mode === "track") && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Show Track only classes in the lists above</p>
            <p className="text-xs text-gray-400">To Grade, Coming Up, Missing and Low Grade. Class averages always include them.</p>
          </div>
          <button role="switch" aria-checked={showTrackOnly} aria-label="Show Track only classes in the lists above"
            disabled={savingAlerts} onClick={toggleTrackOnlyAlerts}
            className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-50 ${showTrackOnly ? "bg-emerald-700" : "bg-gray-200"}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${showTrackOnly ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
      )}

      {editingClass && (
        <ClassSettingModal
          className={editingClass}
          current={classModes[classKey(editingClass)] ?? "pays"}
          assignments={assignments}
          studentName={summary?.studentName ?? "your student"}
          onClose={() => setEditingClass(null)}
          onSaved={(classes, changed) => {
            setClassSettings(s => (s ? { ...s, classes } : s));
            if (changed) onChanged();
          }}
        />
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
      {payingOut && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">💸 Pay out {summary?.studentName ?? "your student"}</h2>
            <div>
              <label htmlFor="payout-amount" className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
              <input id="payout-amount" type="number" inputMode="decimal" min="0" step="0.01" max={balance} value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
              <p className="text-xs text-gray-400 mt-1">
                {fmt(available)} is available after the holdback. You can pay up to the whole balance ({fmt(balance)}).
              </p>
            </div>
            {payValid && (
              <div className="bg-green-50 rounded-2xl p-4 text-sm space-y-1">
                <div className="flex justify-between"><span>Paying out</span><span className="font-bold text-green-600">{fmt(payNumber)}</span></div>
                <div className="flex justify-between"><span>Balance after</span><span className="font-bold">{fmt(Math.round((balance - payNumber) * 100) / 100)}</span></div>
              </div>
            )}
            <p className="text-sm text-gray-500">
              This records the payout right away and locks the paid work under Past Grades. It does <span className="font-semibold">not</span> send
              anything — pay {summary?.studentName ?? "your student"} yourself (Venmo, cash, etc.).
            </p>
            {payError && <p className="text-sm text-red-500">{payError}</p>}
            <button onClick={handlePayOut} disabled={!payValid || paySaving}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-40">
              {paySaving ? "Recording…" : payValid ? `Pay out ${fmt(payNumber)}` : "Pay out"}
            </button>
            <button onClick={() => setPayingOut(false)} disabled={paySaving} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
      {showImport && (
        <ImportModal
          assignments={assignments}
          studentName={summary?.studentName ?? "your student"}
          studentId={summary?.studentId ?? null}
          rewardsStartDate={summary?.rewardsStartDate ?? null}
          onClose={() => { setShowImport(false); loadClassSettings(); }}
          onImported={onChanged}
        />
      )}
    </div>
  );
}
