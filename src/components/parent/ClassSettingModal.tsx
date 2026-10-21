import { useEffect, useRef, useState } from "react";
import type { Assignment } from "../../types";
import { setClassMode, type ClassChangeEffect, type ClassMode, type ClassSetting } from "../../lib/api";
import { classKey } from "../../lib/import/normalize";
import { useFormatAmount } from "../../lib/rewardSettingsContext";

interface ClassSettingModalProps {
  className: string;
  current: ClassMode;
  /** The student's work, to say how much of this class is already in the app. */
  assignments: Assignment[];
  studentName: string;
  onClose: () => void;
  /** After saving: the student's class settings now, and whether work already in the app changed. */
  onSaved: (classes: ClassSetting[], changedExisting: boolean) => void;
}

const OPTIONS: { mode: ClassMode; title: string; hint: string }[] = [
  { mode: "pays", title: "Pays", hint: "Imported and graded, and earns or costs rewards like any class." },
  { mode: "track", title: "Track only", hint: "Imported and graded, counts in class averages, but never earns or costs anything." },
  { mode: "leave_out", title: "Leave out", hint: "Skipped by grade imports entirely." },
];

/** Parent-only: choose Pays / Track only / Leave out for one class, and whether work already in the app follows. */
export function ClassSettingModal({ className, current, assignments, studentName, onClose, onSaved }: ClassSettingModalProps) {
  const fmt = useFormatAmount();
  const [mode, setMode] = useState<ClassMode>(current);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [effect, setEffect] = useState<ClassChangeEffect | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef("");

  const key = classKey(className);
  const inClass = assignments.filter(a => classKey(a.subject) === key);
  // Work whose Track only flag would flip if the setting is applied to it. Paid-out work never changes.
  const affectable = mode === "leave_out" ? [] : inClass.filter(a => !a.payoutId && !!a.trackOnly !== (mode === "track"));
  const paidOut = inClass.filter(a => a.payoutId).length;

  // The exact balance change comes from the server (it prices at today's rates).
  useEffect(() => {
    setEffect(null);
    if (affectable.length === 0) return;
    const tag = `${mode}`;
    latest.current = tag;
    setClassMode({ className, mode, applyToExisting: true }, true)
      .then(r => { if (latest.current === tag) setEffect(r.affected); })
      .catch(err => { if (latest.current === tag) setError(err instanceof Error ? err.message : "Couldn't load the preview"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, className]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const apply = applyToExisting && affectable.length > 0;
      const r = await setClassMode({ className, mode, applyToExisting: apply });
      onSaved(r.classes ?? [], apply && r.affected.count > 0);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setSaving(false);
    }
  }

  const unchanged = mode === current && !(affectable.length > 0 && applyToExisting);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4" role="dialog" aria-label={`${className} setting`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{className}</h2>
            <p className="text-xs text-gray-400">for {studentName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-gray-400 text-xl disabled:opacity-30" aria-label="Close">✕</button>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="Class setting">
          {OPTIONS.map(o => (
            <button key={o.mode} role="radio" aria-checked={mode === o.mode} onClick={() => { setMode(o.mode); setError(null); }}
              className={`w-full text-left rounded-xl border px-4 py-3 ${mode === o.mode ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"}`}>
              <p className="text-sm font-semibold text-gray-800">{o.title}{o.mode === current ? <span className="text-xs font-normal text-gray-400"> · now</span> : null}</p>
              <p className="text-xs text-gray-500">{o.hint}</p>
            </button>
          ))}
        </div>

        {affectable.length > 0 && (
          <div className="rounded-2xl border border-gray-100 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              {affectable.length} {className} item{affectable.length === 1 ? " is" : "s are"} already in the app (not paid out)
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Work already in the app">
              {([
                [true, mode === "track" ? "Set them to $0 too" : "Pay for them too", effect
                  ? `Balance ${fmt(effect.balanceBefore)} → ${fmt(effect.balanceAfter)} (${fmt(effect.delta, { signed: true })})`
                  : "Working out the change…"],
                [false, "Only work added from now on", "What's already in the app keeps its reward"],
              ] as const).map(([value, title, hint]) => (
                <button key={String(value)} role="radio" aria-checked={applyToExisting === value} onClick={() => setApplyToExisting(value)}
                  className={`w-full text-left rounded-xl border px-4 py-2.5 ${applyToExisting === value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"}`}>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{hint}</p>
                </button>
              ))}
            </div>
            {mode === "pays" && <p className="text-xs text-gray-400">Priced at today's reward amounts. No retake windows are opened for old work.</p>}
          </div>
        )}
        {mode !== "leave_out" && paidOut > 0 && (
          <p className="text-xs text-gray-400">{paidOut} paid-out item{paidOut === 1 ? " stays" : "s stay"} as paid.</p>
        )}
        {mode === "leave_out" && inClass.length > 0 && (
          <p className="text-xs text-gray-500">
            The {inClass.length} item{inClass.length === 1 ? "" : "s"} already in the app stay{inClass.length === 1 ? "s" : ""} as{" "}
            {inClass.length === 1 ? "it is" : "they are"}. Delete them from the Balance page (Select) if you don't want them.
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving} className="flex-1 bg-white text-gray-600 py-3 rounded-xl text-sm border border-gray-200 disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || unchanged || (applyToExisting && affectable.length > 0 && !effect)}
            className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
