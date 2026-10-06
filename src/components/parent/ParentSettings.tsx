import { useEffect, useState } from "react";
import type { AuthUser, RewardSettings } from "../../types";
import { addAccount, fetchFamilyAccounts, fetchRewardSettings, resetUserPassword, saveRewardSettings, setRewardsStart, type FamilyAccount, type PasswordResetResult } from "../../lib/api";
import { formatDay } from "../../lib/dates";
import { ChangePasswordCard } from "../shared/ChangePasswordCard";
import { AppearanceCard } from "../shared/AppearanceCard";
import { Avatar } from "../shared/Avatar";
import { DEFAULT_REWARD_SETTINGS, unitWord } from "../../lib/rewards";
import { AvatarPicker } from "./AvatarPicker";

interface ParentSettingsProps {
  user: AuthUser;
  /** Called after the student list or a student's details change (added, new picture). */
  onStudentsChanged: () => void;
  /** Called with the saved settings so every screen switches to the new amounts immediately. */
  onSettingsSaved: (settings: RewardSettings) => void;
}

type AmountKey = "assignmentReward" | "quizReward" | "testReward" | "assignmentPenalty" | "quizPenalty" | "testPenalty";

/** The three kinds of work, each with its own reward and its own penalty. */
const REWARD_FIELDS: { label: string; key: AmountKey }[] = [
  { label: "Regular assignment", key: "assignmentReward" },
  { label: "Quiz", key: "quizReward" },
  { label: "Test / exam", key: "testReward" },
];
const PENALTY_FIELDS: { label: string; key: AmountKey }[] = [
  { label: "Regular assignment", key: "assignmentPenalty" },
  { label: "Quiz", key: "quizPenalty" },
  { label: "Test / exam", key: "testPenalty" },
];

type SettingsTab = "rewards" | "payouts" | "family" | "account";
const TABS: { val: SettingsTab; icon: string; label: string }[] = [
  { val: "rewards", icon: "🏆", label: "Rewards" },
  { val: "payouts", icon: "💸", label: "Payouts" },
  { val: "family", icon: "👨‍👩‍👧", label: "Family" },
  { val: "account", icon: "👤", label: "My Account" },
];

/** One labeled number box: "Quiz  $ [10] each". */
function NumberRow({ label, hint, value, onChange, prefix, suffix, max, children }: {
  label: string; hint?: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; max?: number; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {children}
        {prefix && <span className="text-gray-500 text-sm">{prefix}</span>}
        <input type="number" min={0} max={max} value={value} onChange={e => onChange(parseFloat(e.target.value))}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {suffix && <span className="text-gray-400 text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

/** What to show around a reward amount's number box for the selected type. */
function rewardAffixes(s: Pick<RewardSettings, "rewardType" | "customUnit">, suffix: string): { prefix: string; suffix: string } {
  return s.rewardType === "money" ? { prefix: "$", suffix } : { prefix: "", suffix: `${unitWord(s)} ${suffix}` };
}

const BONUS_FIELDS: { key: "excellenceBonus" | "streakBonus"; label: string; desc: string }[] = [
  { key: "excellenceBonus", label: "Excellence Bonus", desc: "Extra reward for 80%+ and 90%+ grades" },
  { key: "streakBonus", label: "Weekly Streak Bonus", desc: "Bonus for completing all assignments in a week" },
];

const REWARD_TYPES: { val: RewardSettings["rewardType"]; icon: string; label: string }[] = [
  { val: "money", icon: "💰", label: "Money" },
  { val: "screen", icon: "🎮", label: "Screen Time" },
  { val: "points", icon: "⭐", label: "Points" },
  { val: "custom", icon: "🎁", label: "Custom" },
];

const PAYOUT_SCHEDULES: { val: RewardSettings["payoutSchedule"]; label: string }[] = [
  { val: "request", label: "Student Request + Approval" },
  { val: "monthly", label: "Monthly Automatic" },
  { val: "manual", label: "Parent Initiated Only" },
];

export function ParentSettings({ user, onStudentsChanged, onSettingsSaved }: ParentSettingsProps) {
  const [tab, setTab] = useState<SettingsTab>("rewards");
  const [settings, setSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [accounts, setAccounts] = useState<FamilyAccount[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [editingStart, setEditingStart] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [savingStart, setSavingStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleSaveStart(studentId: string) {
    setSavingStart(true);
    setStartError(null);
    try {
      await setRewardsStart(studentId, startDraft);
      setEditingStart(null);
      loadAccounts();
      onStudentsChanged(); // the header summary carries the date too
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't save the date");
    } finally {
      setSavingStart(false);
    }
  }
  const [resetResult, setResetResult] = useState<PasswordResetResult | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<"parent" | "student" | null>(null);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<PasswordResetResult | null>(null);
  const [pickingFor, setPickingFor] = useState<FamilyAccount | null>(null);

  function update<K extends keyof RewardSettings>(key: K, val: RewardSettings[K]) {
    setSettings({ ...settings, [key]: val });
    setSaved(false);
  }

  /** Flip the holdback between a fixed amount and a percentage of the balance (a percentage can't exceed 100). */
  function switchHoldbackType(t: RewardSettings["holdbackType"]) {
    setSettings({ ...settings, holdbackType: t, holdback: t === "percent" && settings.holdback > 100 ? 20 : settings.holdback });
    setSaved(false);
  }

  function loadAccounts() {
    fetchFamilyAccounts().then(setAccounts).catch(err => console.error("Failed to load accounts", err));
  }

  useEffect(() => {
    loadAccounts();
    fetchRewardSettings().then(setSettings).catch(err => console.error("Failed to load reward settings", err));
  }, []);

  async function handleAddAccount() {
    if (!addRole) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await addAccount(addRole, addName.trim(), addEmail.trim());
      setAddResult(result);
      setAddName("");
      setAddEmail("");
      setAddRole(null);
      loadAccounts();
      if (addRole === "student") onStudentsChanged();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : `Failed to add ${addRole} account`);
    } finally {
      setAdding(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveRewardSettings(settings);
      setSettings(result);
      onSettingsSaved(result);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(userId: string) {
    setResettingId(userId);
    setResetError(null);
    try {
      const result = await resetUserPassword(userId);
      setResetResult(result);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setResettingId(null);
    }
  }

  const byName = (a: FamilyAccount, b: FamilyAccount) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  // Admin is always first among parents; everyone else (and all students) alphabetical.
  const parents = accounts.filter(a => a.role === "parent").sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || byName(a, b));
  const students = accounts.filter(a => a.role === "student").sort(byName);

  const unit = settings.rewardType === "money" ? "$" : unitWord(settings, 2);
  const showSave = tab === "rewards" || tab === "payouts";

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Settings categories">
        {TABS.map(t => (
          <button key={t.val} role="tab" aria-selected={tab === t.val} onClick={() => setTab(t.val)}
            className={`min-h-14 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 border ${tab === t.val ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
            <span className="text-lg leading-none">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === "rewards" && <>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <p className="text-xs text-gray-400 font-medium">REWARD TYPE</p>
        <div className="grid grid-cols-2 gap-2">
          {REWARD_TYPES.map(r => (
            <button key={r.val} onClick={() => update("rewardType", r.val)}
              className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${settings.rewardType === r.val ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
              <span>{r.icon}</span>{r.label}
            </button>
          ))}
        </div>
        {settings.rewardType === "custom" && (
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">What do you call the reward?</span>
            <input
              value={settings.customUnit} maxLength={20} placeholder="e.g. stars, tokens, minutes of gaming"
              onChange={e => update("customUnit", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </label>
        )}
        <p className="text-xs text-gray-400">
          Changing the type only changes the unit shown. Numbers aren't converted (20 stays 20), so review the amounts below. It's best to choose this before grades start adding up.
        </p>
      </div>


        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-medium">REWARDS</p>
            <p className="text-xs text-gray-400 mt-1">Earned when the work is graded at or above the passing grade.</p>
          </div>
          {REWARD_FIELDS.map(f => {
            const { prefix, suffix } = rewardAffixes(settings, "each");
            return <NumberRow key={f.key} label={f.label} value={settings[f.key]} onChange={n => update(f.key, n)} prefix={prefix} suffix={suffix} />;
          })}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <p className="text-xs text-gray-400 font-medium">PASSING GRADE &amp; RETAKES</p>
          <NumberRow label="Passing grade" hint="At or above this earns the reward." value={settings.passingThreshold} onChange={n => update("passingThreshold", n)} suffix="%" max={100} />
          <NumberRow label="Retake window" hint="Time to retake missing or failed work." value={settings.makeupWindow} onChange={n => update("makeupWindow", n)} suffix="days" />
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-medium">PENALTIES</p>
            <p className="text-xs text-gray-400 mt-1">Taken away when work is graded <span className="font-semibold">below</span> the passing grade. Set 0 for no penalty. Missing work is never penalized, and a passing retake within the retake window reverses the penalty.</p>
          </div>
          {PENALTY_FIELDS.map(f => {
            const { prefix, suffix } = rewardAffixes(settings, "lost");
            return <NumberRow key={f.key} label={f.label} value={settings[f.key]} onChange={n => update(f.key, n)} prefix={prefix} suffix={suffix} />;
          })}
        </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">BONUS FEATURES</p>
        {BONUS_FIELDS.map(b => (
          <div key={b.key} className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-gray-700">{b.label}</p><p className="text-xs text-gray-400">{b.desc}</p></div>
            <button onClick={() => update(b.key, !settings[b.key])}
              className={`w-12 h-6 rounded-full transition-all relative ${settings[b.key] ? "bg-indigo-600" : "bg-gray-200"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${settings[b.key] ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      </>}

      {tab === "payouts" && <>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">PAYOUT SCHEDULE</p>
        {PAYOUT_SCHEDULES.map(p => (
          <button key={p.val} onClick={() => update("payoutSchedule", p.val)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${settings.payoutSchedule === p.val ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-gray-50 text-gray-600 border border-transparent"}`}>
            {settings.payoutSchedule === p.val ? "✅ " : ""}{p.label}
          </button>
        ))}
      </div>


        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-medium">HOLDBACK</p>
            <p className="text-xs text-gray-400 mt-1">Kept back from every payout to cover penalties on work that's still coming in. Choose a fixed amount or a percentage of the balance.</p>
          </div>
          <NumberRow label="Hold back" value={settings.holdback} onChange={n => update("holdback", n)} suffix={settings.holdbackType === "percent" ? "of balance" : "each payout"}
            max={settings.holdbackType === "percent" ? 100 : undefined}>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 mr-1" role="group" aria-label="Holdback is a fixed amount or a percentage">
              {(["amount", "percent"] as const).map(t => (
                <button key={t} onClick={() => switchHoldbackType(t)} aria-pressed={settings.holdbackType === t}
                  className={`px-2.5 py-1 text-xs font-semibold ${settings.holdbackType === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>{t === "amount" ? unit : "%"}</button>
              ))}
            </div>
          </NumberRow>
          {settings.holdbackType === "percent" && (
            <p className="text-xs text-gray-400">The holdback is that percentage of the balance at the moment a payout is requested (for example 20% of a {settings.rewardType === "money" ? "$119" : "119"} balance holds back {settings.rewardType === "money" ? "$23.80" : "23.8"}).</p>
          )}
        </div>
      </>}

      {tab === "family" && <>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">ACCOUNT ACCESS</p>
        {resetError && <p className="text-sm text-red-500">{resetError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {([
            { role: "parent", title: "Parents", people: parents, empty: "No parent accounts." },
            { role: "student", title: "Students", people: students, empty: "No students yet." },
          ] as const).map(col => (
            <div key={col.role} className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{col.title}</p>
              {col.people.length === 0 && <p className="text-xs text-gray-400">{col.empty}</p>}
              {col.people.map(a => {
                const canReset = a.id !== user.id && (a.role === "student" || user.isAdmin);
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    {a.role === "student" ? (
                      <button onClick={() => setPickingFor(a)} className="relative shrink-0" aria-label={`Change ${a.name}'s picture`}>
                        <Avatar avatar={a.avatar} name={a.name} size={44} />
                        <span className="absolute -bottom-0.5 -right-0.5 bg-white border border-gray-200 rounded-full w-5 h-5 text-[10px] flex items-center justify-center">✏️</span>
                      </button>
                    ) : (
                      <Avatar avatar={null} name={a.name} size={44} muted />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">
                        {a.name}
                        {a.isAdmin && <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{a.email}</p>
                      {a.role === "student" && (
                        editingStart === a.id ? (
                          <div className="mt-1.5 space-y-1.5">
                            <label htmlFor={`start-${a.id}`} className="block text-xs font-medium text-gray-500">Rewards start on</label>
                            <input id={`start-${a.id}`} type="date" max={new Date().toLocaleDateString("en-CA")} value={startDraft}
                              onChange={e => setStartDraft(e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                            <p className="text-xs text-gray-400">Applies to work added from now on; nothing already entered is re-priced.</p>
                            {startError && <p className="text-xs text-red-500">{startError}</p>}
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveStart(a.id)} disabled={!startDraft || savingStart}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40">{savingStart ? "Saving…" : "Save"}</button>
                              <button onClick={() => setEditingStart(null)} className="text-xs text-gray-500 px-2">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Rewards start: {a.rewardsStartDate ? formatDay(a.rewardsStartDate) : "not set (asked on first import)"}
                            {" · "}
                            <button onClick={() => { setEditingStart(a.id); setStartDraft(a.rewardsStartDate ?? ""); setStartError(null); }}
                              className="text-indigo-600 font-medium">Change</button>
                          </p>
                        )
                      )}
                      {canReset && (
                        <button
                          onClick={() => handleReset(a.id)}
                          disabled={resettingId === a.id}
                          className="mt-1.5 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                        >
                          {resettingId === a.id ? "Resetting…" : "Reset Password"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {user.isAdmin && (
                <button
                  onClick={() => { setAddRole(col.role); setAddError(null); }}
                  className="mt-auto w-full text-sm text-indigo-600 font-medium border border-dashed border-indigo-200 rounded-xl py-2.5"
                >
                  + Add {col.role === "parent" ? "Parent" : "Student"} Account
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      </>}

      {tab === "account" && <>
        <AppearanceCard />

        <ChangePasswordCard />
      </>}

      {showSave && (
        <div className="sticky bottom-2 z-10 space-y-2">
          {saveError && <p className="text-sm text-red-500 text-center bg-white rounded-xl py-1 shadow">{saveError}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm shadow-lg disabled:opacity-40"
          >
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Settings"}
          </button>
        </div>
      )}

      {pickingFor && (
        <AvatarPicker
          student={pickingFor}
          onClose={() => setPickingFor(null)}
          onSaved={() => { loadAccounts(); onStudentsChanged(); }}
        />
      )}

      {resetResult && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Password Reset</h2>
            <p className="text-sm text-gray-500">
              New temporary password for <span className="font-semibold">{resetResult.name}</span> ({resetResult.email}).
              Write it down now — it won't be shown again, and they'll be signed out of any active session.
            </p>
            <div className="bg-indigo-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700 tracking-wide font-mono">{resetResult.password}</p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {addRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Add {addRole === "parent" ? "Parent" : "Student"} Account</h2>
            {addError && <p className="text-sm text-red-500">{addError}</p>}
            <input
              placeholder="Name"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="email"
              placeholder="Email"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleAddAccount}
              disabled={adding || !addName.trim() || !addEmail.trim()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
            >
              {adding ? "Adding…" : `Add ${addRole === "parent" ? "Parent" : "Student"}`}
            </button>
            <button onClick={() => setAddRole(null)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {addResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{addResult.role === "student" ? "Student" : "Parent"} Account Created</h2>
            <p className="text-sm text-gray-500">
              Temporary password for <span className="font-semibold">{addResult.name}</span> ({addResult.email}).
              Write it down now — it won't be shown again. They should log in and set their own password{addResult.role === "student" ? " from their Profile tab" : " from Settings"}.
            </p>
            <div className="bg-indigo-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700 tracking-wide font-mono">{addResult.password}</p>
            </div>
            <button
              onClick={() => setAddResult(null)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
