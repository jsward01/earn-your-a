import { useEffect, useState } from "react";
import type { EmailAlertSettings } from "../../types";
import { fetchEmailAlertSettings, saveEmailAlertSettings, sendTestEmail } from "../../lib/api";

interface EmailAlertsCardProps {
  isParent: boolean;
  studentName: string;
}

type AlertKey = "due1day" | "dueToday" | "makeup" | "payout" | "messages";

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
    { key: "messages", label: "New messages", hint: "When someone writes in the family chat and you haven't read it yet" },
  ];
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM (midnight)";
  if (hour === 12) return "12 PM (noon)";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Switch({ on, label, accent, onChange }: { on: boolean; label: string; accent: string; onChange: (on: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${on ? accent : "bg-gray-200"}`}>
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${on ? "left-6" : "left-0.5"}`} />
    </button>
  );
}

/** Each user's own email alert choices, sent by the alerts Worker (workers/alerts). */
export function EmailAlertsCard({ isParent, studentName }: EmailAlertsCardProps) {
  const [settings, setSettings] = useState<EmailAlertSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Send test email": goes to the saved address, so it's only offered once nothing is waiting to be saved.
  const [savedAddr, setSavedAddr] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchEmailAlertSettings()
      .then(s => { setSettings(s); setSavedAddr(s.emailAddr); })
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
      const next = await saveEmailAlertSettings(settings);
      setSettings(next);
      setSavedAddr(next.emailAddr);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your alert settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const to = await sendTestEmail();
      setTestResult({ ok: true, text: `Sent to ${to}. It should arrive within a minute — check spam too.` });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "Couldn't send the test" });
    } finally {
      setTesting(false);
    }
  }

  const unsavedAddr = settings.emailAddr.trim() !== savedAddr.trim();

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

      <div className={`space-y-3 ${settings.email ? "" : "opacity-50"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-700">Quiet hours</p>
            <p className="text-xs text-gray-400">No emails during these hours. Payout emails wait until they end.</p>
          </div>
          <Switch on={settings.quietHours} label="Quiet hours" accent={accent} onChange={quietHours => update({ quietHours })} />
        </div>
        {settings.quietHours && (
          <div className="grid grid-cols-2 gap-3">
            {([["quietStart", "From"], ["quietEnd", "Until"]] as const).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`alert-${key}`} className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <select
                  id={`alert-${key}`}
                  value={settings[key]}
                  onChange={e => update({ [key]: Number(e.target.value) })}
                  className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${ring}`}
                >
                  {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className={`w-full ${accent} text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40`}>
        {saving ? "Saving…" : saved ? "✓ Saved!" : "Save"}
      </button>
      {savedAddr && (
        <button onClick={handleTest} disabled={testing || unsavedAddr}
          className="w-full bg-white text-gray-700 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40">
          {testing ? "Sending…" : "✉️ Send test email"}
        </button>
      )}
      {unsavedAddr && savedAddr && <p className="text-xs text-gray-400">Save the new address first, then send a test to it.</p>}
      {testResult && <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-500"}`}>{testResult.text}</p>}
      <p className="text-xs text-gray-400">
        "Due today" and retake emails go out around 7 AM, "Due tomorrow" around 5 PM, and payout and message emails within
        about 15 minutes. Alerts always show on this screen too. Text messages are coming later.
      </p>
    </div>
  );
}
