import { useEffect, useState } from "react";
import type { EmailAlertSettings } from "../../types";
import { fetchEmailAlertSettings, saveEmailAlertSettings } from "../../lib/api";

interface EmailAlertsCardProps {
  isParent: boolean;
  studentName: string;
}

type AlertKey = "due1day" | "dueToday" | "makeup" | "payout";

function alertOptions(isParent: boolean, studentName: string): { key: AlertKey; label: string; hint: string }[] {
  const whose = isParent ? `${studentName}'s` : "your";
  return [
    { key: "due1day", label: "Due tomorrow", hint: `The evening before ${whose} work is due` },
    { key: "dueToday", label: "Due today", hint: `The morning ${whose} work is due` },
    { key: "makeup", label: "Retake closing", hint: `When ${whose} retake window has 2 days left` },
    {
      key: "payout",
      label: "Payouts",
      hint: isParent ? `When ${studentName} asks for a payout` : "When a parent approves or denies your payout",
    },
  ];
}

function Switch({ on, label, accent, onChange }: { on: boolean; label: string; accent: string; onChange: (on: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${on ? accent : "bg-gray-200"}`}>
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${on ? "left-6" : "left-0.5"}`} />
    </button>
  );
}

/** Each user's own email alert choices. Saved now; sending is built separately. */
export function EmailAlertsCard({ isParent, studentName }: EmailAlertsCardProps) {
  const [settings, setSettings] = useState<EmailAlertSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailAlertSettings()
      .then(setSettings)
      .catch(e => setLoadError(e instanceof Error ? e.message : "Couldn't load your alert settings"));
  }, []);

  const accent = isParent ? "bg-emerald-700" : "bg-indigo-600";
  const ring = isParent ? "focus:ring-emerald-300" : "focus:ring-indigo-300";

  if (loadError) return <p className="text-sm text-red-500">{loadError}</p>;
  if (!settings) return <p className="text-sm text-gray-400">Loading…</p>;

  function update(patch: Partial<EmailAlertSettings>) {
    setSettings(prev => prev && { ...prev, ...patch });
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      setSettings(await saveEmailAlertSettings(settings));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your alert settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {settings.allowedByParent === false && (
        <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-3 py-2">
          A parent has turned off email alerts for you, so no emails will be sent. Your choices below are kept for when they turn it back on.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">Email me alerts</p>
          <p className="text-xs text-gray-400">Only you see this address. Each person picks their own alerts.</p>
        </div>
        <Switch on={settings.email} label="Email me alerts" accent={accent} onChange={email => update({ email })} />
      </div>

      <div>
        <label htmlFor="alert-email" className="block text-xs font-medium text-gray-500 mb-1">Email address</label>
        <input
          id="alert-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={settings.emailAddr}
          onChange={e => update({ emailAddr: e.target.value })}
          className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
        />
      </div>

      <div className={`space-y-3 ${settings.email ? "" : "opacity-50"}`}>
        <p className="text-xs text-gray-400 font-medium">SEND AN EMAIL FOR</p>
        {alertOptions(isParent, studentName).map(o => (
          <div key={o.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-sm text-gray-700">{o.label}</p><p className="text-xs text-gray-400">{o.hint}</p></div>
            <Switch on={settings[o.key]} label={o.label} accent={accent} onChange={on => update({ [o.key]: on })} />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className={`w-full ${accent} text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40`}>
        {saving ? "Saving…" : saved ? "✓ Saved!" : "Save"}
      </button>
      <p className="text-xs text-gray-400">
        Emails haven't started yet. Your choices are saved now, and alerts begin once email sending is switched on.
        Alerts always show on this screen too. Text messages are coming later.
      </p>
    </div>
  );
}
