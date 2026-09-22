import { useState } from "react";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../../lib/theme";

const CHOICES: { val: ThemeChoice; icon: string; label: string }[] = [
  { val: "light", icon: "☀️", label: "Light" },
  { val: "dark", icon: "🌙", label: "Dark" },
  { val: "system", icon: "🖥️", label: "Auto" },
];

/** Light / Dark / Auto. Remembered on this device only, so a phone and a laptop can differ. */
export function AppearanceCard() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);

  function pick(c: ThemeChoice) {
    setChoice(c);
    setThemeChoice(c);
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <p className="text-xs text-gray-400 font-medium">APPEARANCE</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Appearance">
        {CHOICES.map(c => (
          <button key={c.val} onClick={() => pick(c.val)} aria-pressed={choice === c.val}
            className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${choice === c.val ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400">Auto follows this device's own light/dark setting. This choice is remembered on this device only.</p>
    </div>
  );
}
