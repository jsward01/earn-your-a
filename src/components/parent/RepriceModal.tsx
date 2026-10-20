import { useState } from "react";
import { applyReprice, type RepricePreview } from "../../lib/api";
import { useFormatAmount } from "../../lib/rewardSettingsContext";

interface RepriceModalProps {
  preview: RepricePreview;
  /** true when it opened right after saving new amounts (offers "From now on"); false from the Recalculate button. */
  afterSave: boolean;
  onClose: () => void;
  onApplied: () => void;
}

const TYPE_WORD = { assignment: ["assignment", "assignments"], quiz: ["quiz", "quizzes"], test: ["test", "tests"] } as const;

/**
 * Ask whether already-graded work should be re-priced at today's rates. Shows what it would do per student first,
 * with a warning when it takes money back.
 */
export function RepriceModal({ preview, afterSave, onClose, onApplied }: RepriceModalProps) {
  const fmt = useFormatAmount();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      await applyReprice();
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't recalculate");
      setApplying(false);
    }
  }

  const takesBack = preview.students.some(s => s.delta < 0);
  const touchesPaid = preview.students.some(s => s.paid.count > 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">{afterSave ? "Apply to past grades too?" : "Recalculate graded work"}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl" aria-label="Close">✕</button>
        </div>

        <p className="text-sm text-gray-500">
          {afterSave
            ? "The new amounts apply to work graded from now on. Work that's already graded can also be recalculated at the new amounts:"
            : "Some graded work was priced under different amounts than today's. Recalculating would do this:"}
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {preview.students.map(s => (
          <div key={s.studentId} className={`rounded-2xl p-3 text-sm border ${s.delta < 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <p className="font-semibold text-gray-800">{s.name}</p>
            <ul className="mt-1 space-y-0.5 text-gray-600">
              {s.groups.map(g => (
                <li key={`${g.type}-${g.before}-${g.after}`}>
                  {g.count} {TYPE_WORD[g.type][g.count === 1 ? 0 : 1]}: {fmt(g.before)} → {fmt(g.after)} ({fmt(g.delta, { signed: true })})
                </li>
              ))}
            </ul>
            {s.paid.count > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {s.paid.count} of these {s.paid.count === 1 ? "was" : "were"} already paid out. {s.paid.count === 1 ? "It stays" : "They stay"} locked; the difference ({fmt(s.paid.delta, { signed: true })}) is added as one catch-up entry.
              </p>
            )}
            <p className="mt-2 text-gray-700">Balance: <span className="font-semibold">{fmt(s.balanceBefore)} → {fmt(s.balanceAfter)}</span> ({fmt(s.delta, { signed: true })})</p>
          </div>
        ))}

        {takesBack && (
          <p className="text-sm rounded-2xl p-3 bg-amber-50 border border-amber-200 text-amber-800">
            ⚠️ This takes money back.{touchesPaid ? " Some of it was already paid out, so the balance can go below zero until new work earns it back." : ""}
          </p>
        )}

        <button onClick={handleApply} disabled={applying} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
          {applying ? "Recalculating…" : "Recalculate all graded work"}
        </button>
        <button onClick={onClose} disabled={applying} className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-sm">
          {afterSave ? "From now on only" : "Cancel"}
        </button>
        <p className="text-xs text-gray-400">
          Each recalculated item notes the change in its history. Past payouts don't change.
        </p>
      </div>
    </div>
  );
}
