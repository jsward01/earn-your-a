import { useRef, useState } from "react";
import { applyReprice, fetchRepricePreview, type RepricePreview } from "../../lib/api";
import { useFormatAmount } from "../../lib/rewardSettingsContext";
import { formatDay } from "../../lib/dates";

interface RepriceModalProps {
  onClose: () => void;
  onApplied: () => void;
}

const TYPE_WORD = { assignment: ["assignment", "assignments"], quiz: ["quiz", "quizzes"], test: ["test", "tests"] } as const;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Asked right after a parent saves new reward or penalty amounts: keep them for new grades only ("Starting now"), or
 * also recalculate work due on or after a chosen date (e.g. the start of a semester). Picking a date shows what it
 * would do, per student, before anything changes.
 */
export function RepriceModal({ onClose, onApplied }: RepriceModalProps) {
  const fmt = useFormatAmount();
  const [choice, setChoice] = useState<"now" | "date">("now");
  const [from, setFrom] = useState("");
  const [preview, setPreview] = useState<RepricePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localToday();
  // Only the newest date's preview is shown when dates are picked quickly.
  const latest = useRef("");

  function pickDate(date: string) {
    setFrom(date);
    setPreview(null);
    setError(null);
    latest.current = date;
    if (!date) return;
    setLoading(true);
    fetchRepricePreview(date)
      .then(p => { if (latest.current === date) setPreview(p); })
      .catch(err => { if (latest.current === date) setError(err instanceof Error ? err.message : "Couldn't load the preview"); })
      .finally(() => { if (latest.current === date) setLoading(false); });
  }

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      await applyReprice(from);
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't recalculate");
      setApplying(false);
    }
  }

  const changes = preview?.students ?? [];
  const takesBack = changes.some(s => s.delta < 0);
  const touchesPaid = changes.some(s => s.paid.count > 0);
  const canApply = choice === "date" && !!preview && changes.length > 0 && !applying;
  const option = (on: boolean) => `w-full text-left rounded-2xl p-3 border ${on ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">When should the new amounts start?</h2>
          <button onClick={onClose} disabled={applying} className="text-gray-400 text-xl" aria-label="Close">✕</button>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="When the new amounts start">
          <button role="radio" aria-checked={choice === "now"} onClick={() => setChoice("now")} className={option(choice === "now")}>
            <p className="text-sm font-semibold text-gray-800">Starting now</p>
            <p className="text-xs text-gray-500">Work graded from now on uses the new amounts. Graded work keeps what it earned.</p>
          </button>
          <button role="radio" aria-checked={choice === "date"} onClick={() => setChoice("date")} className={option(choice === "date")}>
            <p className="text-sm font-semibold text-gray-800">From a date</p>
            <p className="text-xs text-gray-500">Also recalculate graded work due on or after a date, like the start of a semester.</p>
          </button>
        </div>

        {choice === "date" && (
          <div>
            <label htmlFor="reprice-from" className="block text-xs font-medium text-gray-500 mb-1">Recalculate work due on or after</label>
            <input id="reprice-from" type="date" max={today} value={from} onChange={e => pickDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {choice === "date" && loading && <p className="text-sm text-gray-400">Checking graded work…</p>}

        {choice === "date" && preview && changes.length === 0 && (
          <p className="text-sm text-gray-500">Nothing due on or after {formatDay(from)} would change: it's already at these amounts.</p>
        )}

        {choice === "date" && changes.map(s => (
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

        {choice === "date" && takesBack && (
          <p className="text-sm rounded-2xl p-3 bg-amber-50 border border-amber-200 text-amber-800">
            ⚠️ This takes money back.{touchesPaid ? " Some of it was already paid out, so the balance can go below zero until new work earns it back." : ""}
          </p>
        )}

        {choice === "now" ? (
          <button onClick={onClose} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">Done</button>
        ) : (
          <button onClick={handleApply} disabled={!canApply} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
            {applying ? "Recalculating…" : from ? `Recalculate from ${formatDay(from)}` : "Pick a date"}
          </button>
        )}
        <p className="text-xs text-gray-400">
          Past payouts never change. Each recalculated item notes the change in its history.
        </p>
      </div>
    </div>
  );
}
