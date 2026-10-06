import { useState } from "react";
import { createAdjustment } from "../../lib/api";
import { useFormatAmount } from "../../lib/rewardSettingsContext";

interface AdjustmentModalProps {
  studentName: string;
  balance: number;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_REASON = 200;

/** Parent-only manual +/- entry with a reason: the fix for a mistake in work that's already been paid out and locked. */
export function AdjustmentModal({ studentName, balance, onClose, onSaved }: AdjustmentModalProps) {
  const fmt = useFormatAmount();
  const [direction, setDirection] = useState<"add" | "subtract">("add");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const magnitude = Math.round(Number(amountText) * 100) / 100;
  const valid = amountText.trim() !== "" && Number.isFinite(magnitude) && magnitude > 0 && reason.trim() !== "";
  const signedAmount = direction === "add" ? magnitude : -magnitude;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await createAdjustment(signedAmount, reason.trim());
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the adjustment");
      setSaving(false);
    }
  }

  const input = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const label = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Adjust Balance</h2>
            <p className="text-xs text-gray-400">for {studentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl" aria-label="Close">✕</button>
        </div>

        <p className="text-sm text-gray-500">
          Use this to fix a mistake in work that's already been paid out, or for anything outside the grade rules.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <span className={label}>Direction</span>
          <div className="grid grid-cols-2 gap-2">
            {(["add", "subtract"] as const).map(d => (
              <button key={d} onClick={() => setDirection(d)}
                className={`py-2.5 rounded-xl text-sm font-semibold border ${
                  direction === d
                    ? d === "add" ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-500 border-gray-200"
                }`}>
                {d === "add" ? "+ Add" : "− Take away"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="adj-amount" className={label}>Amount</label>
          <input id="adj-amount" type="number" inputMode="decimal" min={0} step="0.01" className={input}
            placeholder="e.g. 20" value={amountText} onChange={e => setAmountText(e.target.value)} />
        </div>

        <div>
          <label htmlFor="adj-reason" className={label}>Reason (shown to {studentName})</label>
          <textarea id="adj-reason" rows={2} maxLength={MAX_REASON} className={input}
            placeholder="e.g. Unit 2 test was regraded 62% → 85% after payout"
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        {valid && (
          <div className="rounded-2xl p-3 text-sm bg-amber-50 border border-amber-200">
            <p className="text-gray-700">Balance: <span className="font-semibold">{fmt(balance)} → {fmt(balance + signedAmount)}</span> ({fmt(signedAmount, { signed: true })})</p>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Adjustments can't be edited or deleted. To undo one, add another going the other way. They lock with the next payout, like grades.
        </p>

        <button onClick={handleSave} disabled={!valid || saving} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
          {saving ? "Saving…" : "Save Adjustment"}
        </button>
      </div>
    </div>
  );
}
