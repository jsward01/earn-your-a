import { useState } from "react";
import { saveHomeCards } from "../../lib/api";

interface HomeCardsCardProps {
  showClassAverages: boolean;
  showProgress: boolean;
  /** After a save, so the signed-in user's record (and the Home page) match. */
  onSaved: (cards: { showClassAverages: boolean; showProgress: boolean }) => void;
}

const ROWS = [
  { key: "classAverages", label: "Class Averages", hint: "Your average in each class" },
  { key: "progress", label: "Progress chart", hint: "Your grades and earnings week by week" },
] as const;

/** The student's own on/off switches for the cards at the bottom of their Home page. Saved on their account. */
export function HomeCardsCard({ showClassAverages, showProgress, onSaved }: HomeCardsCardProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = { classAverages: showClassAverages, progress: showProgress };

  async function toggle(key: keyof typeof value) {
    setSaving(key);
    setError(null);
    try {
      onSaved(await saveHomeCards({ [key]: !value[key] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    }
    setSaving(null);
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <p className="text-xs text-gray-400 font-medium">HOME PAGE</p>
      {ROWS.map(r => {
        const on = value[r.key];
        return (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">{r.label}</p>
              <p className="text-xs text-gray-400">{r.hint}</p>
            </div>
            <button role="switch" aria-checked={on} aria-label={`Show ${r.label} on Home`} disabled={saving !== null} onClick={() => toggle(r.key)}
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-50 ${on ? "bg-indigo-600" : "bg-gray-200"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${on ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
