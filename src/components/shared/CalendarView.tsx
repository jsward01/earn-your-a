import { useState } from "react";
import type { Assignment } from "../../types";
import { getRewardStatus } from "../../lib/rewards";
import { getSubjectLight } from "../../lib/styles";

interface CalendarViewProps {
  assignments: Assignment[];
  isParent: boolean;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function getWindowStart(base: Date): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildSchoolDays(start: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  while (days.length < 10) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ assignments, isParent }: CalendarViewProps) {
  const today = new Date(2026, 2, 10);
  const [windowStart, setWindowStart] = useState<Date>(() => getWindowStart(today));

  const schoolDays = buildSchoolDays(windowStart);
  const week1 = schoolDays.slice(0, 5);
  const week2 = schoolDays.slice(5, 10);

  function getAssignmentsFor(d: Date): Assignment[] {
    return assignments.filter(a => a.dueDate === toDateStr(d));
  }
  function isToday(d: Date): boolean {
    return toDateStr(d) === toDateStr(today);
  }
  function isPast(d: Date): boolean {
    return d < today && !isToday(d);
  }

  function prevWindow() { const d = new Date(windowStart); d.setDate(d.getDate() - 14); setWindowStart(d); }
  function nextWindow() { const d = new Date(windowStart); d.setDate(d.getDate() + 14); setWindowStart(d); }
  function goToToday() { setWindowStart(getWindowStart(today)); }

  function weekLabel(days: Date[]): string {
    const s = days[0], e = days[4];
    const sm = MONTH_NAMES[s.getMonth()].slice(0, 3), em = MONTH_NAMES[e.getMonth()].slice(0, 3);
    return sm === em ? `${sm} ${s.getDate()} – ${e.getDate()}` : `${sm} ${s.getDate()} – ${em} ${e.getDate()}`;
  }

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";

  function DayColumn({ day }: { day: Date }) {
    const items = getAssignmentsFor(day);
    const todayCell = isToday(day);
    const pastCell = isPast(day);
    return (
      <div className={`flex-1 min-w-0 rounded-2xl overflow-hidden border transition-all
        ${todayCell ? (isParent ? "border-emerald-400 shadow-md" : "border-indigo-400 shadow-md") : "border-gray-100"}
        ${pastCell ? "opacity-60" : ""}
        bg-white`}>
        <div className={`px-1.5 py-2 text-center ${todayCell ? accentBg : "bg-gray-50"}`}>
          <p className={`text-xs font-bold ${todayCell ? "text-white" : "text-gray-400"}`}>
            {DAY_NAMES_SHORT[day.getDay() - 1]}
          </p>
          <p className={`text-base font-bold leading-tight ${todayCell ? "text-white" : "text-gray-700"}`}>
            {day.getDate()}
          </p>
          {todayCell && <p className="text-white text-xs opacity-80">Today</p>}
        </div>
        <div className="p-1.5 space-y-1.5 min-h-16">
          {items.length === 0
            ? <div className="flex items-center justify-center h-10"><p className="text-gray-200 text-lg">—</p></div>
            : items.map(a => {
              const r = getRewardStatus(a);
              return (
                <div key={a.id} className={`rounded-xl px-2 py-1.5 border-l-2 ${
                  a.status === "missing" ? "bg-red-50 border-red-400" :
                  a.status === "graded" && a.grade !== null && a.grade < 70 ? "bg-orange-50 border-orange-400" :
                  a.status === "graded" ? "bg-green-50 border-green-400" :
                  "bg-indigo-50 border-indigo-400"
                }`}>
                  <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{a.title}</p>
                  <div className="flex items-center justify-between mt-0.5 gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium truncate ${getSubjectLight(a.subject)}`} style={{ fontSize: "0.6rem" }}>{a.subject}</span>
                    <span className={`text-xs font-bold shrink-0 ${r.color}`} style={{ fontSize: "0.65rem" }}>{r.label ?? "—"}</span>
                  </div>
                  {a.grade !== null && <p className="text-gray-400 mt-0.5" style={{ fontSize: "0.6rem" }}>{a.grade}% • {a.type}</p>}
                  {a.makeupAvailable && (a.daysLeft ?? 0) > 0 && (
                    <p className="text-orange-500 font-semibold mt-0.5" style={{ fontSize: "0.6rem" }}>⏱ {a.daysLeft}d makeup</p>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  const allMonths = [...new Set(schoolDays.map(d => MONTH_NAMES[d.getMonth()]))];
  const headerLabel = allMonths.join(" / ");
  const yearLabel = schoolDays[0].getFullYear();

  return (
    <div className="pb-28 pt-4 space-y-4">
      <div className={`${accentBg} mx-4 rounded-3xl px-5 py-4 text-white shadow-lg`}>
        <div className="flex items-center justify-between mb-1">
          <button onClick={prevWindow} className="w-9 h-9 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold">‹</button>
          <div className="text-center">
            <p className="font-bold text-lg">{headerLabel} {yearLabel}</p>
            <p className="text-xs opacity-70">2-Week School Calendar</p>
          </div>
          <button onClick={nextWindow} className="w-9 h-9 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold">›</button>
        </div>
        <button onClick={goToToday} className="w-full mt-2 bg-white bg-opacity-20 rounded-xl py-1.5 text-xs font-semibold">
          Jump to Today
        </button>
      </div>

      <div className="mx-4 flex items-center justify-center gap-3 flex-wrap">
        {[
          { color: "bg-indigo-400", label: "Pending" },
          { color: "bg-green-400", label: "Graded ✓" },
          { color: "bg-orange-400", label: "Low Grade" },
          { color: "bg-red-400", label: "Missing" },
        ].map((l, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="px-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Week 1</p>
          <p className="text-xs text-gray-400">{weekLabel(week1)}</p>
        </div>
        <div className="flex gap-1.5">
          {week1.map((d, i) => <DayColumn key={i} day={d} />)}
        </div>
      </div>

      <div className="px-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Week 2</p>
          <p className="text-xs text-gray-400">{weekLabel(week2)}</p>
        </div>
        <div className="flex gap-1.5">
          {week2.map((d, i) => <DayColumn key={i} day={d} />)}
        </div>
      </div>

      <div className="mx-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">2-Week Summary</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Due", val: schoolDays.reduce((s, d) => s + getAssignmentsFor(d).filter(a => a.status === "pending").length, 0), color: "text-indigo-600" },
            { label: "Missing", val: schoolDays.reduce((s, d) => s + getAssignmentsFor(d).filter(a => a.status === "missing").length, 0), color: "text-red-500" },
            { label: "Low Grade", val: schoolDays.reduce((s, d) => s + getAssignmentsFor(d).filter(a => a.grade !== null && a.grade < 70).length, 0), color: "text-orange-500" },
            { label: "Potential", val: `${schoolDays.reduce((s, d) => s + getAssignmentsFor(d).filter(a => a.status === "pending").reduce((ss, a) => ss + (a.type === "assignment" ? 3 : 20), 0), 0)}`, color: "text-green-600" },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-2">
              <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
