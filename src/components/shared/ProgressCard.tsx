import { useMemo, useState } from "react";
import type { Assignment } from "../../types";
import { progressClasses, rangeStart, weeklyEarnings, weeklyGrades } from "../../lib/progress";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { WeekChart } from "./WeekChart";

const RANGES = [
  { key: "year", label: "This school year" },
  { key: "recent", label: "Last 8 weeks" },
] as const;

/**
 * Progress over time (parent Overview and the student's Rewards screen, same for both): average grade per week (all classes or one) and net rewards per week, both by due date. Two
 * charts rather than one with two scales. The range and class choices apply to everything below them.
 */
export function ProgressCard({ assignments, accent = "emerald" }: { assignments: Assignment[]; /** Parent green or student indigo chips. */ accent?: "emerald" | "indigo" }) {
  const rules = useRewardSettings();
  const fmt = useFormatAmount();
  const [range, setRange] = useState<"year" | "recent">("year");
  const [cls, setCls] = useState<string>("");
  const since = rangeStart(range);
  const classes = useMemo(() => progressClasses(assignments), [assignments]);
  const className = classes.find(c => c.key === cls)?.name;

  const grades = useMemo(
    () => weeklyGrades(assignments, since, cls || null).map(p => ({ week: p.week, value: p.value, detail: `${p.count} graded or missing` })),
    [assignments, since, cls],
  );
  const money = useMemo(
    () => weeklyEarnings(assignments, since).map(p => ({
      week: p.week,
      value: p.value,
      detail: p.count === 0 ? "Nothing graded" : `${fmt(p.earned, { signed: true, short: true })} earned · ${fmt(-p.lost, { short: true })} lost`,
    })),
    [assignments, since, fmt],
  );

  const chip = (on: boolean) => `px-3 py-1 rounded-full text-xs font-semibold ${on ? (accent === "indigo" ? "bg-indigo-600 text-white" : "bg-emerald-700 text-white") : "bg-white text-gray-500 border border-gray-200"}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <p className="font-bold text-gray-800 text-sm">Progress</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} aria-pressed={range === r.key} className={chip(range === r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 pb-4 space-y-2 border-t border-gray-50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700">Average grade by week</p>
            <p className="text-xs text-gray-400">Darker line = passing ({rules.passingThreshold}%)</p>
          </div>
          <label className="sr-only" htmlFor="progress-class">Class</label>
          <select id="progress-class" value={cls} onChange={e => setCls(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white max-w-[55%]">
            <option value="">All classes</option>
            {classes.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        {grades.length === 0
          ? <p className="text-sm text-gray-400">No graded work {className ? `in ${className} ` : ""}in this period yet.</p>
          : <WeekChart kind="line" points={grades} label={className ? `${className} average` : "Average grade"} format={n => `${n}%`} max={100}
              reference={rules.passingThreshold} />}
      </div>

      <div className="px-4 pt-2 pb-4 space-y-2 border-t border-gray-50">
        <p className="text-sm font-semibold text-gray-700">Earned by week <span className="font-normal text-gray-400">(all classes)</span></p>
        {money.length === 0
          ? <p className="text-sm text-gray-400">No rewards earned or lost in this period yet.</p>
          : <WeekChart kind="columns" points={money} label="Net earned" format={n => fmt(n, { short: true })} />}
      </div>

      <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50">
        Weeks run Sunday–Saturday by due date. Grades count missing work as 0 and include Track only and pre-rewards work;
        rewards are what each item earned or cost (adjustments and payouts aren't included). Tap a week for details.
      </p>
    </div>
  );
}
