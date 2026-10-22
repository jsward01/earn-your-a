import { useState } from "react";
import type { Role } from "../../types";
import { ACCENTS, applyAccent, defaultAccent, type Accent } from "../../lib/accent";
import { saveAccent } from "../../lib/api";

interface AccentCardProps {
  role: Role;
  /** The saved choice (null = the role's default). */
  accent: string | null;
  /** After a save, so the signed-in user's record matches. */
  onSaved: (accent: Accent | null) => void;
}

/** Pick the color of your own app: the top bar, banners, buttons and the selected tab. Saved on your account. */
export function AccentCard({ role, accent, onSaved }: AccentCardProps) {
  const fallback = defaultAccent(role);
  const current = (ACCENTS.some(a => a.id === accent) ? accent : fallback) as Accent;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(id: Accent) {
    if (id === current || saving) return;
    const value = id === fallback ? null : id;
    applyAccent(role, value); // show it right away; put it back if the save fails
    setSaving(true);
    setError(null);
    try {
      await saveAccent(value);
      onSaved(value);
    } catch (err) {
      applyAccent(role, accent);
      setError(err instanceof Error ? err.message : "Couldn't save your color.");
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <p className="text-xs text-gray-400 font-medium">COLOR</p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="App color">
        {ACCENTS.map(a => {
          const selected = a.id === current;
          return (
            <button key={a.id} role="radio" aria-checked={selected} onClick={() => pick(a.id)} disabled={saving}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all disabled:opacity-60 ${selected ? "bg-gray-100" : "hover:bg-gray-50"}`}>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${selected ? "ring-2 ring-offset-2 ring-gray-400" : ""}`}
                style={{ backgroundColor: a.swatch }}>
                {selected ? "✓" : ""}
              </span>
              <span className="text-xs text-gray-600">{a.label}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-gray-400">Changes the top bar, banners, buttons and tabs. Only you see your color, on any device you sign in on.</p>
    </div>
  );
}
