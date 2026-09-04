import { useState } from "react";
import type { RewardSettings } from "../../types";

const DEFAULT_SETTINGS: RewardSettings = {
  assignmentReward: 3, testReward: 20, passingThreshold: 70,
  makeupWindow: 7, holdback: 20, rewardType: "money",
  excellenceBonus: true, streakBonus: true,
  payoutSchedule: "request",
};

const REWARD_AMOUNT_FIELDS: { label: string; key: keyof RewardSettings; prefix: string; suffix: string }[] = [
  { label: "Assignment Reward", key: "assignmentReward", prefix: "$", suffix: "each" },
  { label: "Test / Quiz Reward", key: "testReward", prefix: "$", suffix: "each" },
  { label: "Passing Threshold", key: "passingThreshold", prefix: "", suffix: "%" },
  { label: "Makeup Window", key: "makeupWindow", prefix: "", suffix: "days" },
  { label: "Payout Holdback", key: "holdback", prefix: "$", suffix: "buffer" },
];

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

export function ParentSettings() {
  const [settings, setSettings] = useState<RewardSettings>(DEFAULT_SETTINGS);

  function update<K extends keyof RewardSettings>(key: K, val: RewardSettings[K]) {
    setSettings({ ...settings, [key]: val });
  }

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
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
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <p className="text-xs text-gray-400 font-medium">REWARD AMOUNTS</p>
        {REWARD_AMOUNT_FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between">
            <p className="text-sm text-gray-700">{f.label}</p>
            <div className="flex items-center gap-1">
              {f.prefix && <span className="text-gray-500 text-sm">{f.prefix}</span>}
              <input type="number" value={settings[f.key] as number} onChange={e => update(f.key, parseFloat(e.target.value) as RewardSettings[typeof f.key])}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-gray-400 text-xs">{f.suffix}</span>
            </div>
          </div>
        ))}
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

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">PAYOUT SCHEDULE</p>
        {PAYOUT_SCHEDULES.map(p => (
          <button key={p.val} onClick={() => update("payoutSchedule", p.val)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${settings.payoutSchedule === p.val ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-gray-50 text-gray-600 border border-transparent"}`}>
            {settings.payoutSchedule === p.val ? "✅ " : ""}{p.label}
          </button>
        ))}
      </div>

      <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm shadow">Save Settings</button>
    </div>
  );
}
