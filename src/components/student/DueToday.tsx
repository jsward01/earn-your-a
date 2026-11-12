import { useState } from "react";
import type { Assignment } from "../../types";
import { groupDueWork } from "../../lib/assignments";
import { penaltyAmountFor, potentialReward } from "../../lib/rewards";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { getSubjectColor, getSubjectLight, getDaysLeftColor, bannerGradient } from "../../lib/styles";
import { daysUntilDate } from "../../lib/dates";
import { ClassAverages } from "../shared/ClassAverages";
import { ProgressCard } from "../shared/ProgressCard";

interface DueTodayProps {
  assignments: Assignment[];
  onOpen: (a: Assignment) => void;
  onAdd: () => void;
  /** Switch to the full list of every assignment (graded, missing, and so on). */
  onShowAll: () => void;
  /** Her own choice (Profile → Home page); both default on. */
  showClassAverages: boolean;
  showProgress: boolean;
}

const TYPE_LABEL: Record<Assignment["type"], string> = { assignment: "Assignment", quiz: "Quiz", test: "Test" };

type HomeFilter = "all" | "missing" | "retakes" | "week" | "waiting" | "later";

/** A "YYYY-MM-DD" due date as a local calendar day (never shifted by time zone). */
function localDay(dueDate: string): Date {
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shortDay(dueDate: string): string {
  return localDay(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Due Today" / "Due Tomorrow" in red, the next 3 days in yellow, then the weekday or date in gray. */
function dueLabel(dueDate: string): { text: string; color: string } {
  const days = daysUntilDate(dueDate);
  if (days === 0) return { text: "Due Today", color: "text-red-600 font-bold" };
  if (days === 1) return { text: "Due Tomorrow", color: "text-red-500 font-bold" };
  const weekday = localDay(dueDate).toLocaleDateString(undefined, { weekday: "long" });
  if (days <= 3) return { text: `Due ${weekday}`, color: "text-yellow-600 font-semibold" };
  if (days <= 6) return { text: `Due ${weekday}`, color: "text-gray-500" };
  return { text: `Due ${shortDay(dueDate)}`, color: "text-gray-400" };
}

/** Row background + left edge by how soon it's due (matches the parent Overview's Coming Up). */
function dueRowColor(dueDate: string): string {
  const days = daysUntilDate(dueDate);
  if (days <= 1) return "border-red-300 bg-red-50";
  if (days <= 3) return "border-yellow-300 bg-yellow-50";
  return "border-gray-200 bg-white";
}

function waitingLabel(dueDate: string): string {
  const days = -daysUntilDate(dueDate);
  return days === 1 ? "Was due yesterday" : `Was due ${days} days ago`;
}

/** Missing work whose makeup window is still open, so turning it in can still earn the reward. */
function canTurnIn(a: Assignment): boolean {
  return !!a.makeupAvailable && (a.daysLeft ?? 0) > 0;
}

function Row({ a, onOpen, rowColor, chip, right }: {
  a: Assignment;
  onOpen: (a: Assignment) => void;
  rowColor: string;
  chip?: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <button onClick={() => onOpen(a)} className={`w-full text-left flex items-center justify-between px-4 py-3 border-l-4 active:opacity-80 ${rowColor}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{a.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
            <span className="text-xs text-gray-400">{TYPE_LABEL[a.type]}</span>
            {chip}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">{right}</div>
    </button>
  );
}

function Card({ icon, title, count, countColor, hint, empty, children }: {
  icon: string;
  title: string;
  count: number;
  countColor: string;
  hint?: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{icon}</span>
          <p className="font-bold text-gray-800 text-sm">{title}</p>
          {hint && <span className="text-xs text-gray-400 truncate">{hint}</span>}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${countColor}`}>{count}</span>
      </div>
      {count === 0
        ? <p className="text-sm text-gray-400 px-4 pb-4">{empty}</p>
        : <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

export function DueToday({ assignments, onOpen, onAdd, onShowAll, showClassAverages, showProgress }: DueTodayProps) {
  const rules = useRewardSettings();
  const fmt = useFormatAmount();
  const [filter, setFilter] = useState<HomeFilter>("all");
  const groups = groupDueWork(assignments, rules.passingThreshold);
  const week = [...groups.today, ...groups.tomorrow, ...groups.thisWeek];
  // All missing work not yet settled by a payout, open turn-in windows first (soonest deadline), then the rest by due date.
  // Missing work with an open window is left out of Retakes so nothing shows up twice.
  const missing = assignments
    .filter(a => a.status === "missing" && !a.historyOnly && !a.payoutId)
    .sort((a, b) => Number(canTurnIn(b)) - Number(canTurnIn(a)) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || b.dueDate.localeCompare(a.dueDate));
  const retakes = groups.fixIt.filter(a => a.status !== "missing");

  const worth = (a: Assignment) => {
    const n = potentialReward(a, rules);
    return n === null ? "Tracking only" : fmt(n, { signed: true, short: true });
  };
  const worthColor = (a: Assignment) => (a.trackOnly ? "text-gray-500" : "text-green-600");
  /** Quizzes and tests can cost money below passing; say so on the row. */
  const riskChip = (a: Assignment) => {
    if (a.trackOnly) return null;
    const penalty = penaltyAmountFor(a.type, rules);
    return penalty > 0 ? <span className="text-xs text-red-500">{fmt(-penalty, { short: true })} if under {rules.passingThreshold}%</span> : null;
  };
  const dueRow = (a: Assignment) => {
    const due = dueLabel(a.dueDate);
    return (
      <Row key={a.id} a={a} onOpen={onOpen} rowColor={dueRowColor(a.dueDate)} chip={riskChip(a)}
        right={<>
          <p className={`text-xs ${due.color}`}>{due.text}</p>
          <p className={`text-sm font-bold mt-0.5 ${worthColor(a)}`}>{worth(a)}</p>
        </>} />
    );
  };

  // What she can still earn in the next 7 days: everything due today through day 6, plus every open makeup.
  const upForGrabs = [...week, ...groups.fixIt].reduce((sum, a) => sum + (potentialReward(a, rules) ?? 0), 0);
  const show = (f: Exclude<HomeFilter, "all">) => filter === "all" || filter === f;

  return (
    <div className="px-4 pt-4 pb-20 space-y-4">
      <div className={`${bannerGradient(false)} rounded-3xl p-5 text-white shadow`}>
        <p className="text-sm opacity-80">Up for grabs this week</p>
        <p className="text-4xl font-bold mt-1">{fmt(upForGrabs, { short: true })}</p>
        <p className="text-sm opacity-80 mt-2">Get {rules.passingThreshold}% or better to earn it</p>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setFilter("all")} aria-pressed={filter === "all"}
          className={`text-sm font-semibold px-4 py-2 rounded-lg border ${filter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>All</button>
        <div className="flex gap-2">
          <button onClick={onShowAll} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-2 rounded-lg">📚 All work</button>
          <button onClick={onAdd} className="text-sm bg-indigo-50 text-indigo-700 font-medium px-3 py-2 rounded-lg">+ Add</button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {([
          { key: "week", label: "This Week", val: week.length, color: groups.today.length > 0 ? "text-red-500" : "text-indigo-600", bg: groups.today.length > 0 ? "bg-red-50" : "bg-indigo-50" },
          { key: "missing", label: "Missing", val: missing.length, color: missing.length > 0 ? "text-red-500" : "text-green-600", bg: missing.length > 0 ? "bg-red-50" : "bg-green-50" },
          { key: "retakes", label: "Retakes", val: retakes.length, color: retakes.length > 0 ? "text-orange-500" : "text-green-600", bg: retakes.length > 0 ? "bg-orange-50" : "bg-green-50" },
          { key: "waiting", label: "Waiting", val: groups.waiting.length, color: "text-amber-600", bg: "bg-amber-50" },
          { key: "later", label: "Coming Up", val: groups.later.length, color: "text-gray-600", bg: "bg-gray-50" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFilter(filter === t.key ? "all" : t.key)} aria-pressed={filter === t.key}
            className={`${t.bg} rounded-2xl px-1 py-2 shadow-sm text-center border active:opacity-80 ${filter === t.key ? "border-indigo-600 ring-2 ring-indigo-600" : "border-gray-100"}`}>
            <p className={`text-xl font-bold ${t.color}`}>{t.val}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.label}</p>
          </button>
        ))}
      </div>

      {show("missing") && (
        <Card icon="🚨" title="Missing" count={missing.length} countColor={missing.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}
          empty="No missing work 🎉">
          {missing.map(a => {
            const left = a.daysLeft ?? 0;
            return canTurnIn(a)
              ? <Row key={a.id} a={a} onOpen={onOpen} rowColor={left <= 2 ? "border-red-400 bg-red-50" : "border-orange-400 bg-orange-50"}
                chip={<span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(left)}`}>⏱ {left}d to turn in</span>}
                right={<>
                  <p className="text-xs text-orange-600 font-semibold">Turn it in</p>
                  <p className={`text-sm font-bold mt-0.5 ${a.trackOnly ? "text-gray-500" : "text-orange-600"}`}>{worth(a)}</p>
                </>} />
              : <Row key={a.id} a={a} onOpen={onOpen} rowColor="border-red-400 bg-red-50"
                right={<>
                  <p className="text-xs text-red-500 font-semibold">Was due {shortDay(a.dueDate)}</p>
                  <p className="text-sm font-bold text-red-500 mt-0.5">{a.trackOnly ? "Tracking only" : fmt(a.recordedReward ?? 0, { signed: true, short: true })}</p>
                </>} />;
          })}
        </Card>
      )}

      {show("retakes") && (retakes.length > 0 || filter === "retakes") && (
        <Card icon="🛠️" title="Retakes" hint="earn it back" count={retakes.length} countColor="bg-orange-100 text-orange-700"
          empty="Nothing to retake 🎉">
          {retakes.map(a => {
            const left = a.daysLeft ?? 0;
            return (
              <Row key={a.id} a={a} onOpen={onOpen} rowColor={left <= 2 ? "border-red-400 bg-red-50" : "border-orange-400 bg-orange-50"}
                chip={<span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(left)}`}>⏱ {left}d left</span>}
                right={<>
                  <p className="text-xs text-orange-600 font-semibold">Retake it · {a.grade}%</p>
                  <p className="text-sm font-bold text-orange-600 mt-0.5">{worth(a)}</p>
                </>} />
            );
          })}
        </Card>
      )}

      {show("week") && (
        <Card icon="📅" title="Due This Week" count={week.length} countColor="bg-indigo-100 text-indigo-700"
          empty="Nothing due this week 🎉">
          {week.map(dueRow)}
        </Card>
      )}

      {show("waiting") && (groups.waiting.length > 0 || filter === "waiting") && (
        <Card icon="⏳" title="Waiting for a Grade" hint="a parent grades these" count={groups.waiting.length} countColor="bg-amber-100 text-amber-700"
          empty="Nothing waiting on a grade">
          {groups.waiting.map(a => (
            <Row key={a.id} a={a} onOpen={onOpen} rowColor="border-amber-400 bg-amber-50"
              right={<>
                <p className="text-xs text-amber-700 font-semibold">{waitingLabel(a.dueDate)}</p>
                <p className="text-sm font-bold text-gray-400 mt-0.5">{worth(a)}</p>
              </>} />
          ))}
        </Card>
      )}

      {show("later") && (groups.later.length > 0 || filter === "later") && (
        <Card icon="🗓️" title="Coming Up" hint="next week and later" count={groups.later.length} countColor="bg-gray-100 text-gray-700"
          empty="Nothing further out yet">
          {groups.later.map(dueRow)}
        </Card>
      )}

      {filter === "all" && showClassAverages && <ClassAverages assignments={assignments} />}

      {filter === "all" && showProgress && <ProgressCard assignments={assignments} accent="indigo" />}
    </div>
  );
}
