import { useState } from "react";
import type { Assignment, PayoutAction } from "../../types";
import { getSubjectColor, getSubjectLight, getDaysLeftColor } from "../../lib/styles";

interface ParentOverviewProps {
  assignments: Assignment[];
  payoutPending: boolean;
  setPayoutPending: (pending: boolean) => void;
}

function getDueSoonColor(date: string): string {
  const days = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return "border-red-300 bg-red-50";
  if (days <= 3) return "border-yellow-300 bg-yellow-50";
  return "border-gray-200 bg-white";
}

function getDueSoonLabel(date: string): { text: string; color: string } {
  const days = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return { text: "Due Today", color: "text-red-600 font-bold" };
  if (days === 1) return { text: "Due Tomorrow", color: "text-red-500 font-bold" };
  if (days <= 3) return { text: `Due in ${days} days`, color: "text-yellow-600 font-semibold" };
  return { text: `Due ${date}`, color: "text-gray-400" };
}

export function ParentOverview({ assignments, payoutPending, setPayoutPending }: ParentOverviewProps) {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAction, setPayoutAction] = useState<PayoutAction | null>(null);
  const balance = 23;
  const holdback = 20;
  const available = balance - holdback;

  const upcoming = assignments
    .filter(a => a.status === "pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const missing = assignments.filter(a => a.status === "missing");
  const lowGrade = assignments.filter(a => a.status === "graded" && a.grade !== null && a.grade < 70);

  const graded = assignments.filter(a => a.grade !== null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length) : 0;

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">

      {payoutPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💸</span>
            <div><p className="font-bold text-yellow-800">Payout Request from Sarah</p><p className="text-xs text-yellow-600">Requesting ${available}.00 • Submitted just now</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPayoutAction("approve"); setShowPayoutModal(true); }} className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-bold">✅ Approve</button>
            <button onClick={() => { setPayoutAction("delay"); setShowPayoutModal(true); }} className="flex-1 bg-yellow-400 text-yellow-900 py-2 rounded-xl text-sm font-bold">⏰ Delay</button>
            <button onClick={() => { setPayoutAction("deny"); setShowPayoutModal(true); }} className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-sm font-bold">❌ Deny</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Upcoming", val: upcoming.length, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Missing", val: missing.length, color: missing.length > 0 ? "text-red-500" : "text-green-600", bg: missing.length > 0 ? "bg-red-50" : "bg-green-50" },
          { label: "Low Grade", val: lowGrade.length, color: lowGrade.length > 0 ? "text-orange-500" : "text-green-600", bg: lowGrade.length > 0 ? "bg-orange-50" : "bg-green-50" },
          { label: "Avg Grade", val: `${avgGrade}%`, color: avgGrade >= 90 ? "text-green-600" : avgGrade >= 70 ? "text-indigo-600" : "text-red-500", bg: "bg-white" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-3 shadow-sm text-center border border-gray-100`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* SECTION 1: Upcoming Assignments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <p className="font-bold text-gray-800 text-sm">Upcoming Assignments</p>
          </div>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcoming.length}</span>
        </div>
        {upcoming.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No upcoming assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {upcoming.map(a => {
              const due = getDueSoonLabel(a.dueDate);
              return (
                <div key={a.id} className={`flex items-center justify-between px-4 py-3 border-l-4 ${getDueSoonColor(a.dueDate)}`}>
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
                    <p className="text-xs text-indigo-500 font-semibold mt-0.5">{a.type === "assignment" ? "$3" : "$20"} potential</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* SECTION 2: Missing Assignments */}
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
              <div key={a.id} className="flex items-center justify-between px-4 py-3 border-l-4 border-red-400 bg-red-50">
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
                  <p className="text-xs text-red-500 font-bold">$0.00</p>
                  <p className="text-xs text-gray-400">was ${a.type === "assignment" ? "$3" : "$20"}</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      {/* SECTION 3: Low Grade Assignments */}
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
                <div key={a.id} className="flex items-center justify-between px-4 py-3 border-l-4 border-orange-400 bg-orange-50">
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

      {showPayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            {payoutAction === "approve" && <>
              <h2 className="text-lg font-bold text-gray-800">✅ Approve Payout</h2>
              <div className="bg-green-50 rounded-2xl p-4">
                <div className="flex justify-between text-sm mb-2"><span>Amount</span><span className="font-bold text-green-600">${available}.00</span></div>
                <div className="flex justify-between text-sm"><span>Holdback retained</span><span className="font-bold">${holdback}.00</span></div>
              </div>
              <button onClick={() => { setPayoutPending(false); setShowPayoutModal(false); }} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold">Confirm Approval</button>
            </>}
            {payoutAction === "delay" && <>
              <h2 className="text-lg font-bold text-gray-800">⏰ Delay Payout</h2>
              <p className="text-sm text-gray-500">The payout will stay pending. Sarah will be notified you'll pay soon.</p>
              <div className="grid grid-cols-3 gap-2">
                {["Tonight", "This Weekend", "Next Week"].map(d => (
                  <button key={d} onClick={() => { setPayoutPending(false); setShowPayoutModal(false); }} className="bg-yellow-100 text-yellow-800 py-3 rounded-xl text-sm font-semibold">{d}</button>
                ))}
              </div>
            </>}
            {payoutAction === "deny" && <>
              <h2 className="text-lg font-bold text-gray-800">❌ Deny Payout</h2>
              <p className="text-sm text-gray-500">Sarah will be notified the payout was denied and the balance will remain.</p>
              <button onClick={() => { setPayoutPending(false); setShowPayoutModal(false); }} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold">Confirm Denial</button>
            </>}
            <button onClick={() => setShowPayoutModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
