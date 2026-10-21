import { useEffect, useState } from "react";
import type { Assignment } from "../../types";
import { deleteAssignments, fetchAdjustments, fetchPayouts, type Adjustment, type PayoutRequestRow, type RewardSummary } from "../../lib/api";
import { getRewardStatus } from "../../lib/rewards";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { formatDay, shortDate } from "../../lib/dates";
import { getSubjectLight } from "../../lib/styles";
import { AdjustmentModal } from "../parent/AdjustmentModal";

interface BalancePageProps {
  assignments: Assignment[];
  summary: RewardSummary | null;
  /** Students see their grades but can't change them; parents can tap a current grade to edit it. */
  readOnly: boolean;
  onBack: () => void;
  onEdit: (a: Assignment) => void;
  onAdd: () => void;
  /** Called after a parent adds an adjustment, so the header balance refreshes. */
  onChanged: () => void;
  /** Called after a parent deletes several items at once, so the app reloads assignments and the balance. */
  onDeleted: () => void;
}

type Tab = "current" | "past" | "history" | "track";

const byDueDesc = (a: Assignment, b: Assignment) => b.dueDate.localeCompare(a.dueDate);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function BalancePage({ assignments, summary, readOnly, onBack, onEdit, onAdd, onChanged, onDeleted }: BalancePageProps) {
  const rules = useRewardSettings();
  const fmt = useFormatAmount();
  const signed = (n: number) => fmt(n, { signed: true });
  const [tab, setTab] = useState<Tab>("current");
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  // Multi-select (parents): pick several grades, then delete them in one go.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAdjustments = () => fetchAdjustments().then(setAdjustments).catch(err => console.error("Failed to load adjustments", err));

  useEffect(() => {
    fetchPayouts().then(setPayouts).catch(err => console.error("Failed to load payouts", err));
    loadAdjustments();
  }, []);

  // "Current" = finished work that hasn't been settled by a payout yet (graded or missing; pending work has no grade to show).
  const current = assignments.filter(a => a.status !== "pending" && !a.payoutId && !a.historyOnly && !a.trackOnly).sort(byDueDesc);
  // Work from before rewards started: on record (and in averages), never owed anything, so it gets its own list.
  const history = assignments.filter(a => a.historyOnly && a.status !== "pending").sort(byDueDesc);
  // Work in Track only classes: graded and averaged, $0, never paid out — its own list too.
  const tracked = assignments.filter(a => a.trackOnly && !a.historyOnly && a.status !== "pending").sort(byDueDesc);
  const currentAdjustments = adjustments.filter(x => !x.payoutId);
  const currentTotal = round2(
    current.reduce((s, a) => s + (a.recordedReward ?? 0), 0) + currentAdjustments.reduce((s, x) => s + x.amount, 0),
  );
  const balance = summary?.balance ?? 0;
  // Whatever the balance holds beyond the current list: money earned in earlier periods but not paid out (the holdback), or a carried-forward negative.
  const carriedOver = round2(balance - currentTotal);

  const settled = assignments.filter(a => a.payoutId);
  const settledAdjustments = adjustments.filter(x => x.payoutId);
  const groups = [...new Set([...settled.map(a => a.payoutId as string), ...settledAdjustments.map(x => x.payoutId as string)])]
    .map(id => {
      const items = settled.filter(a => a.payoutId === id).sort(byDueDesc);
      const adj = settledAdjustments.filter(x => x.payoutId === id);
      const payout = payouts.find(p => p.id === id);
      return {
        id,
        paidAt: payout?.resolvedAt ?? items[0]?.paidAt ?? null,
        paid: payout?.amount ?? null,
        items,
        adj,
        total: round2(items.reduce((s, a) => s + (a.recordedReward ?? 0), 0) + adj.reduce((s, x) => s + x.amount, 0)),
      };
    })
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));

  // The list the Select button works on: whichever editable tab is showing.
  const selectable = tab === "current" ? current : tab === "history" ? history : tab === "track" ? tracked : [];
  const pickedItems = selectable.filter(a => picked.has(a.id));
  const pickedTotal = round2(pickedItems.reduce((s, a) => s + (a.recordedReward ?? 0), 0));
  const classes = [...new Set(selectable.map(a => a.subject))].sort();

  function stopSelecting() {
    setSelecting(false);
    setPicked(new Set());
    setConfirming(false);
    setDeleteError(null);
  }

  function toggle(id: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Tap a class: select everything in it, or clear it if it's all selected already. */
  function toggleClass(subject: string) {
    const ids = selectable.filter(a => a.subject === subject).map(a => a.id);
    setPicked(prev => {
      const next = new Set(prev);
      const all = ids.every(id => next.has(id));
      for (const id of ids) if (all) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const { skipped } = await deleteAssignments(pickedItems.map(a => a.id));
      onDeleted();
      if (skipped.length > 0) {
        setDeleteError(`${skipped.length} couldn't be deleted (already paid out, or no longer there).`);
        setConfirming(false);
        setPicked(new Set());
      } else {
        stopSelecting();
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete — try again");
    } finally {
      setDeleting(false);
    }
  }

  function row(a: Assignment, editable: boolean) {
    const r = getRewardStatus(a, rules);
    const checkable = selecting && editable;
    const body = (
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-left w-full">
        {checkable && (
          <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} onClick={e => e.stopPropagation()}
            className="h-4 w-4 shrink-0 accent-indigo-600" aria-label={`Select ${a.title}`} />
        )}
        <div className="min-w-0 flex-1">
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
          <p className="text-xs text-gray-400">{a.status === "missing" ? "Missing" : a.grade !== null ? `${a.grade}%` : "—"}</p>
        </div>
      </div>
    );
    if (checkable) {
      return <div key={a.id} role="button" tabIndex={0} onClick={() => toggle(a.id)}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(a.id); } }}
        className={`w-full block cursor-pointer ${picked.has(a.id) ? "bg-indigo-50" : "active:bg-gray-50"}`}>{body}</div>;
    }
    return editable
      ? <button key={a.id} onClick={() => onEdit(a)} className="w-full active:bg-gray-50 block">{body}</button>
      : <div key={a.id}>{body}</div>;
  }

  function adjustmentRow(x: Adjustment) {
    return (
      <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 break-words">{x.reason}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Adjustment</span>
            <span className="text-xs text-gray-400">{x.createdByName ? `${x.createdByName} · ` : ""}{shortDate(x.createdAt)}</span>
          </div>
        </div>
        <p className={`text-sm font-bold shrink-0 ${x.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{signed(x.amount)}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-indigo-600 font-medium">‹ Back</button>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => setAdjusting(true)} className="text-sm bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg">± Adjust</button>
            <button onClick={onAdd} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-lg">+ Add graded work</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400 font-medium">{summary?.studentName ? `${summary.studentName.toUpperCase()}'S BALANCE` : "BALANCE"}</p>
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(balance)}</p>
        <p className="text-xs text-gray-400 mt-1">
          {readOnly
            ? "Grades stay open until they're paid out. If something looks wrong, ask a parent."
            : "Tap a grade to edit it — the balance updates as you save. Grades lock once they're paid out; use ± Adjust to fix something after that."}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(["current", "past", ...(history.length > 0 ? ["history"] : []), ...(tracked.length > 0 ? ["track"] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); stopSelecting(); }}
            className={`px-4 py-2 rounded-full text-sm font-medium ${tab === t ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200"}`}>
            {t === "current" ? `Current Grades (${current.length})` : t === "past" ? "Past Grades" : t === "history" ? `Before Rewards (${history.length})` : `Track Only (${tracked.length})`}
          </button>
        ))}
        {!readOnly && selectable.length > 0 && (
          <button onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            className="ml-auto text-sm text-indigo-600 font-medium px-2 py-2">
            {selecting ? "Cancel" : "Select"}
          </button>
        )}
      </div>

      {selecting && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
          <p className="text-xs text-gray-500">Tap grades to select them, or tap a class to select all of it.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPicked(pickedItems.length === selectable.length ? new Set() : new Set(selectable.map(a => a.id)))}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 text-gray-600">
              {pickedItems.length === selectable.length ? "Clear all" : "All"}
            </button>
            {classes.map(c => {
              const ids = selectable.filter(a => a.subject === c);
              const all = ids.every(a => picked.has(a.id));
              return (
                <button key={c} onClick={() => toggleClass(c)} aria-pressed={all}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border ${all ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                  {c} ({ids.length})
                </button>
              );
            })}
          </div>
          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
        </div>
      )}

      {tab === "current" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {carriedOver !== 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-700">Carried over</p>
                <p className="text-xs text-gray-400">Earned in earlier periods, not paid out yet (the holdback)</p>
              </div>
              <p className={`text-sm font-bold ${carriedOver >= 0 ? "text-green-600" : "text-red-500"}`}>{signed(carriedOver)}</p>
            </div>
          )}
          {currentAdjustments.map(adjustmentRow)}
          {current.map(a => row(a, !readOnly))}
          {current.length === 0 && currentAdjustments.length === 0 && <p className="text-sm text-gray-400 px-4 py-6 text-center">No grades since the last payout.</p>}
          {(current.length > 0 || currentAdjustments.length > 0) && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">This period</p>
              <p className={`text-sm font-bold ${currentTotal >= 0 ? "text-green-600" : "text-red-500"}`}>{signed(currentTotal)}</p>
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
                <p className="text-sm font-bold text-gray-700">{g.paid !== null ? fmt(g.paid) : ""}</p>
              </div>
              <div className="divide-y divide-gray-50">{g.adj.map(adjustmentRow)}{g.items.map(a => row(a, false))}</div>
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">{g.adj.length ? "Grades and adjustments in this period" : "Grades in this period"}</p>
                <p className="text-xs font-semibold text-gray-500">{signed(g.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <p className="text-xs text-gray-500 px-4 py-3 bg-gray-50">
            {summary?.rewardsStartDate ? `Due before rewards started (${formatDay(summary.rewardsStartDate)}). ` : ""}
            These count toward averages but never earn or cost anything.
          </p>
          <div className="divide-y divide-gray-50">{history.map(a => row(a, !readOnly))}</div>
        </div>
      )}

      {tab === "track" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <p className="text-xs text-gray-500 px-4 py-3 bg-gray-50">
            Classes set to Track only. These count toward averages but never earn or cost anything, and payouts leave them here.
            {!readOnly && " To change a class, tap it under Class Averages on the Overview."}
          </p>
          <div className="divide-y divide-gray-50">{tracked.map(a => row(a, !readOnly))}</div>
        </div>
      )}

      {selecting && pickedItems.length > 0 && (
        <div className="sticky bottom-20 z-10 bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{pickedItems.length} selected</span>
            {pickedTotal !== 0 && <span className="text-gray-400"> · {signed(-pickedTotal)} on the balance</span>}
          </p>
          <button onClick={() => setConfirming(true)} className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">Delete</button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Delete {pickedItems.length} item{pickedItems.length === 1 ? "" : "s"}?</h2>
            <p className="text-sm text-gray-500">
              {summary?.studentName ?? "The"}{summary?.studentName ? "'s" : ""} balance goes from {fmt(balance)} to {fmt(round2(balance - pickedTotal))}.
              Each delete is kept in the change history. If a class shouldn't come back on the next grade import, leave it out there
              (Import Grades → tap the class).
            </p>
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} disabled={deleting}
                className="flex-1 bg-white text-gray-600 py-3 rounded-xl text-sm border border-gray-200 disabled:opacity-40">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {adjusting && (
        <AdjustmentModal
          studentName={summary?.studentName ?? "your student"}
          balance={balance}
          onClose={() => setAdjusting(false)}
          onSaved={() => { loadAdjustments(); onChanged(); }}
        />
      )}
    </div>
  );
}
