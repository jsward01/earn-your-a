import { useMemo, useState } from "react";
import type { Assignment } from "../../types";
import { classAverages, periodStart, type AveragePeriod } from "../../lib/averages";
import { useRewardSettings } from "../../lib/rewardSettingsContext";
import { classKey } from "../../lib/import/normalize";

const PERIODS: { key: AveragePeriod; label: string }[] = [
  { key: "year", label: "This school year" },
  { key: "recent", label: "Last 4 weeks" },
];

interface ClassAveragesProps {
  assignments: Assignment[];
  /** Parent view: each class's Pays / Track only / Leave out setting by `classKey` (unlisted = Pays). */
  classModes?: Record<string, "track" | "leave_out">;
  /** Parent view: tapping a class opens its setting. */
  onClassTap?: (subject: string) => void;
}

/** Per-class averages (plain, missing = 0) for this school year or the last 4 weeks. */
export function ClassAverages({ assignments, classModes, onClassTap }: ClassAveragesProps) {
  const rules = useRewardSettings();
  const [period, setPeriod] = useState<AveragePeriod>("year");
  const rows = useMemo(() => classAverages(assignments, periodStart(period)), [assignments, period]);

  const color = (avg: number) =>
    avg >= 90 ? { text: "text-green-600", bar: "bg-green-500" }
      : avg >= rules.passingThreshold ? { text: "text-indigo-600", bar: "bg-indigo-500" }
        : { text: "text-red-500", bar: "bg-red-500" };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <p className="font-bold text-gray-800 text-sm">Class Averages</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${period === p.key ? "bg-emerald-700 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-400">No graded work in this period yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(r => {
            const c = r.average === null ? null : color(r.average);
            const mode = classModes?.[classKey(r.subject)];
            const Tag = onClassTap ? "button" : "div";
            return (
              <Tag key={r.subject} onClick={onClassTap ? () => onClassTap(r.subject) : undefined}
                aria-label={onClassTap ? `${r.subject}: change Pays / Track only` : undefined}
                className={`block w-full text-left px-4 py-2.5 ${onClassTap ? "active:bg-gray-50" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {r.subject}
                    {mode === "track" && <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 font-medium">Track only</span>}
                    {mode === "leave_out" && <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">Left out</span>}
                  </p>
                  <p className={`text-sm font-bold ${c?.text ?? "text-gray-400"}`}>{r.average === null ? "—" : `${r.average}%`}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                  {c && <div className={`h-1.5 rounded-full ${c.bar}`} style={{ width: `${r.average}%` }} />}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {r.graded} graded{r.missing > 0 && <span className="text-red-500"> · {r.missing} missing</span>}
                </p>
              </Tag>
            );
          })}
        </div>
      )}
      <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50">
        A plain average of each item's %, with missing work counted as 0. The school weights categories (tests, homework…),
        so its grade can differ a little.{onClassTap && " Tap a class to set it to Pays, Track only ($0) or Leave out."}
      </p>
    </div>
  );
}
