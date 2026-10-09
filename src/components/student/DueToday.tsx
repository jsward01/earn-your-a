import type { Assignment } from "../../types";
import { groupDueWork } from "../../lib/assignments";
import { penaltyAmountFor, rewardAmountFor } from "../../lib/rewards";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { getSubjectColor } from "../../lib/styles";
import { daysUntilDate } from "../../lib/dates";

interface DueTodayProps {
  assignments: Assignment[];
  onOpen: (a: Assignment) => void;
  onAdd: () => void;
}

const TYPE_LABEL: Record<Assignment["type"], string> = { assignment: "Assignment", quiz: "Quiz", test: "Test" };

/** A "YYYY-MM-DD" due date as a local calendar day (never shifted by time zone). */
function localDay(dueDate: string): Date {
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shortDay(dueDate: string): string {
  return localDay(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Due Thursday" within the week, "Due Oct 12" further out. */
function dueLabel(dueDate: string): string {
  const days = daysUntilDate(dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days >= 2 && days <= 6) return `Due ${localDay(dueDate).toLocaleDateString(undefined, { weekday: "long" })}`;
  return `Due ${shortDay(dueDate)}`;
}

function Row({ a, onOpen, worth, worthColor, note, noteColor = "text-gray-400" }: {
  a: Assignment;
  onOpen: (a: Assignment) => void;
  worth: string;
  worthColor: string;
  note: string;
  noteColor?: string;
}) {
  return (
    <button onClick={() => onOpen(a)} className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:opacity-80">
      <div className="flex items-stretch">
        <div className={`w-1.5 shrink-0 ${getSubjectColor(a.subject)}`} />
        <div className="flex-1 min-w-0 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm leading-tight">{a.title}</p>
            <p className="text-xs text-gray-500 mt-1">{a.subject} · {TYPE_LABEL[a.type]}</p>
            <p className={`text-xs mt-1 ${noteColor}`}>{note}</p>
          </div>
          <p className={`font-bold text-sm shrink-0 ${worthColor}`}>{worth}</p>
        </div>
      </div>
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function DueToday({ assignments, onOpen, onAdd }: DueTodayProps) {
  const rules = useRewardSettings();
  const fmt = useFormatAmount();
  const groups = groupDueWork(assignments, rules.passingThreshold);

  const worth = (a: Assignment) => fmt(rewardAmountFor(a.type, rules), { signed: true, short: true });
  const riskNote = (a: Assignment) => {
    const penalty = penaltyAmountFor(a.type, rules);
    return penalty > 0 ? `${fmt(-penalty, { short: true })} if under ${rules.passingThreshold}%` : `${rules.passingThreshold}% or better to earn it`;
  };
  const pendingRow = (a: Assignment, note = dueLabel(a.dueDate)) => (
    <Row key={a.id} a={a} onOpen={onOpen} worth={worth(a)} worthColor="text-green-600" note={`${note} · ${riskNote(a)}`} />
  );

  // What she can still earn in the next 7 days: everything due today through day 6, plus every open makeup.
  const upForGrabs = [...groups.today, ...groups.tomorrow, ...groups.thisWeek, ...groups.fixIt]
    .reduce((sum, a) => sum + rewardAmountFor(a.type, rules), 0);
  const dueThisWeek = groups.today.length + groups.tomorrow.length + groups.thisWeek.length;
  const nothingAtAll = Object.values(groups).every(g => g.length === 0);

  return (
    <div className="px-4 pt-4 pb-20 space-y-5">
      <div className="bg-indigo-600 rounded-3xl p-5 text-white shadow">
        <p className="text-sm opacity-80">Up for grabs this week</p>
        <p className="text-4xl font-bold mt-1">{fmt(upForGrabs, { short: true })}</p>
        <p className="text-sm opacity-80 mt-2">
          {groups.today.length > 0 ? `${groups.today.length} due today · ` : ""}
          {dueThisWeek} due in the next 7 days
          {groups.fixIt.length > 0 ? ` · ${groups.fixIt.length} to fix` : ""}
        </p>
      </div>

      {groups.fixIt.length > 0 && (
        <Section title="⚠️ Fix it before the window closes" hint="earn it back">
          {groups.fixIt.map(a => {
            const left = a.daysLeft ?? 0;
            const closes = left === 1 ? "Closes tomorrow" : `Closes in ${left} days`;
            const action = a.status === "missing" ? "Turn it in" : "Retake it";
            return (
              <Row key={a.id} a={a} onOpen={onOpen} worth={worth(a)} worthColor="text-orange-600"
                note={`${action} and get ${rules.passingThreshold}%+ · ${closes}`}
                noteColor={left <= 2 ? "text-red-600 font-medium" : "text-orange-600"} />
            );
          })}
        </Section>
      )}

      {groups.today.length > 0 && <Section title="Today">{groups.today.map(a => pendingRow(a))}</Section>}
      {groups.tomorrow.length > 0 && <Section title="Tomorrow">{groups.tomorrow.map(a => pendingRow(a))}</Section>}
      {groups.thisWeek.length > 0 && <Section title="This week">{groups.thisWeek.map(a => pendingRow(a))}</Section>}
      {groups.later.length > 0 && <Section title="Coming up">{groups.later.map(a => pendingRow(a))}</Section>}

      {groups.waiting.length > 0 && (
        <Section title="Waiting for a grade" hint="a parent grades these">
          {groups.waiting.map(a => (
            <Row key={a.id} a={a} onOpen={onOpen} worth={worth(a)} worthColor="text-gray-400"
              note={`Was due ${shortDay(a.dueDate)}`} />
          ))}
        </Section>
      )}

      {nothingAtAll && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-gray-600">Nothing due right now</p>
          <p className="text-sm mt-1">Got something new from a teacher?</p>
          <button onClick={onAdd} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm">Add it</button>
        </div>
      )}
    </div>
  );
}
