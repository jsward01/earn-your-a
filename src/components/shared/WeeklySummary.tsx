import type { Assignment } from "../../types";
import { getRewardStatus } from "../../lib/rewards";
import { getSubjectLight } from "../../lib/styles";
import { SUBJECTS } from "../../data/mockData";

interface WeeklySummaryProps {
  assignments: Assignment[];
  isParent: boolean;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY = new Date(2026, 2, 10);

function getPerformanceBadge(missingCount: number, avgGrade: number) {
  if (missingCount === 0 && avgGrade >= 90) return { emoji: "🏆", label: "Outstanding Week!", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" };
  if (missingCount === 0 && avgGrade >= 80) return { emoji: "⭐", label: "Great Week!", color: "text-green-600", bg: "bg-green-50 border-green-200" };
  if (missingCount === 0 && avgGrade >= 70) return { emoji: "✅", label: "Solid Week", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" };
  if (missingCount > 0 && avgGrade >= 70) return { emoji: "⚠️", label: "Missing Work to Fix", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" };
  return { emoji: "🚨", label: "Needs Attention", color: "text-red-600", bg: "bg-red-50 border-red-200" };
}

export function WeeklySummary({ assignments, isParent }: WeeklySummaryProps) {
  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";
  const accentLight = isParent ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700";

  const graded = assignments.filter(a => a.status === "graded" && a.grade !== null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length) : 0;
  const missing = assignments.filter(a => a.status === "missing");
  const makeupOpen = assignments.filter(a => a.makeupAvailable && (a.daysLeft ?? 0) > 0);

  const weekEarned = assignments.reduce((s, a) => {
    const r = getRewardStatus(a);
    return s + (r.earned && r.earned > 0 ? r.earned : 0);
  }, 0);
  const weekLost = assignments.reduce((s, a) => {
    const r = getRewardStatus(a);
    return s + (r.earned && r.earned < 0 ? Math.abs(r.earned) : 0);
  }, 0);
  const weekNet = weekEarned - weekLost;

  const subjectStats = SUBJECTS.map(sub => {
    const subs = assignments.filter(a => a.subject === sub && a.grade !== null);
    const avg = subs.length ? Math.round(subs.reduce((s, a) => s + (a.grade ?? 0), 0) / subs.length) : null;
    const subMissing = assignments.filter(a => a.subject === sub && a.status === "missing").length;
    return { subject: sub, avg, count: subs.length, missing: subMissing };
  }).filter(s => s.count > 0 || s.missing > 0);

  const nextWeek = assignments.filter(a => {
    const d = new Date(a.dueDate);
    const diff = Math.ceil((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const badge = getPerformanceBadge(missing.length, avgGrade);

  const studentMessages = [
    "You're making progress — keep showing up every day and the grades will follow! 💪",
    "Every assignment you complete is one step closer to your goal. Stay consistent!",
    "Don't let the small setbacks define the week. Focus on what you can fix right now.",
  ];
  const parentMessages = [
    "Stay engaged — a quick check-in conversation goes a long way this week.",
    "Review the makeup windows below before they expire. There's still time to recover points.",
    "Consider celebrating the wins this week, even the small ones. Motivation matters!",
  ];
  const tip = isParent ? parentMessages[1] : studentMessages[0];

  return (
    <div className="pb-28 pt-4 space-y-4 px-4">

      <div className={`${accentBg} rounded-3xl p-5 text-white shadow-lg`}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs opacity-70 font-semibold uppercase tracking-wide">Earn Your A</p>
            <p className="text-xl font-bold mt-0.5">Mar 3 – Mar 9, 2026</p>
          </div>
          <div className="text-4xl">📋</div>
        </div>
        <p className="text-xs opacity-60 mt-1">Generated Sunday evening • Next summary in 6 days</p>
      </div>

      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${badge.bg}`}>
        <span className="text-4xl">{badge.emoji}</span>
        <div>
          <p className={`text-lg font-bold ${badge.color}`}>{badge.label}</p>
          <p className="text-sm text-gray-500 mt-0.5">{tip}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`${accentBg} px-4 py-3 flex items-center gap-2`}>
          <span className="text-lg">💰</span>
          <p className="text-white font-bold text-sm">This Week's Rewards</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">+${weekEarned}</p>
            <p className="text-xs text-gray-400 mt-1">Earned</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">-${weekLost}</p>
            <p className="text-xs text-gray-400 mt-1">Lost</p>
          </div>
          <div className="p-4 text-center">
            <p className={`text-2xl font-bold ${weekNet >= 0 ? "text-indigo-600" : "text-red-500"}`}>${weekNet}</p>
            <p className="text-xs text-gray-400 mt-1">Net Total</p>
          </div>
        </div>
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">Running Monthly Total</p>
          <p className="font-bold text-gray-800">$23.00</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">Average Grade</p>
          <p className={`text-3xl font-bold ${avgGrade >= 90 ? "text-green-600" : avgGrade >= 70 ? "text-indigo-600" : "text-red-500"}`}>{avgGrade}%</p>
          <p className="text-xs text-gray-400 mt-1">{graded.length} assignments graded</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${avgGrade >= 90 ? "bg-green-500" : avgGrade >= 70 ? "bg-indigo-500" : "bg-red-500"}`} style={{ width: `${avgGrade}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">Completion Rate</p>
          <p className={`text-3xl font-bold ${missing.length === 0 ? "text-green-600" : "text-orange-500"}`}>
            {assignments.length > 0 ? Math.round(((assignments.length - missing.length) / assignments.length) * 100) : 100}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{missing.length} missing</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${missing.length === 0 ? "bg-green-500" : "bg-orange-500"}`}
              style={{ width: `${assignments.length > 0 ? Math.round(((assignments.length - missing.length) / assignments.length) * 100) : 100}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <span>📚</span>
          <p className="font-bold text-gray-800 text-sm">Grade by Subject</p>
        </div>
        <div className="divide-y divide-gray-50">
          {subjectStats.map((s, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(s.subject)}`}>{s.subject}</span>
                  {s.missing > 0 && <span className="text-xs text-red-500 font-semibold">⚠️ {s.missing} missing</span>}
                </div>
                <span className={`font-bold text-sm ${s.avg === null ? "text-gray-400" : s.avg >= 90 ? "text-green-600" : s.avg >= 70 ? "text-indigo-600" : "text-red-500"}`}>
                  {s.avg !== null ? `${s.avg}%` : "—"}
                </span>
              </div>
              {s.avg !== null && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${s.avg >= 90 ? "bg-green-500" : s.avg >= 70 ? "bg-indigo-500" : "bg-red-500"}`} style={{ width: `${s.avg}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {makeupOpen.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-100">
            <span className="text-lg">⏱</span>
            <p className="font-bold text-orange-700 text-sm">Open Makeup Windows</p>
            <span className="ml-auto bg-orange-200 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">{makeupOpen.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {makeupOpen.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                    <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full border font-bold ${(a.daysLeft ?? 0) <= 1 ? "bg-red-100 text-red-700 border-red-300" : (a.daysLeft ?? 0) <= 3 ? "bg-yellow-100 text-yellow-700 border-yellow-300" : "bg-green-100 text-green-700 border-green-300"}`}>⏱ {a.daysLeft}d left</span>
                  {a.grade && <p className="text-xs text-gray-400 mt-1">Current: {a.grade}%</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <span>🔭</span>
          <p className="font-bold text-gray-800 text-sm">Coming Up Next Week</p>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${accentLight}`}>{nextWeek.length} due</span>
        </div>
        {nextWeek.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4 text-center">Nothing due next week 🎉</p>
          : <div className="divide-y divide-gray-50">
            {nextWeek.map(a => {
              const daysAway = Math.ceil((new Date(a.dueDate).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 ${daysAway <= 2 ? "bg-red-100" : daysAway <= 4 ? "bg-yellow-100" : "bg-gray-100"}`}>
                    <p className="text-xs font-bold text-gray-500 leading-none">{MONTH_ABBR[new Date(a.dueDate).getMonth()]}</p>
                    <p className={`text-base font-bold leading-tight ${daysAway <= 2 ? "text-red-600" : daysAway <= 4 ? "text-yellow-600" : "text-gray-700"}`}>{new Date(a.dueDate).getDate()}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                      <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${daysAway <= 2 ? "text-red-500" : daysAway <= 4 ? "text-yellow-600" : "text-gray-400"}`}>
                      {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway}d`}
                    </p>
                    <p className="text-xs text-indigo-500 font-semibold">{a.type === "assignment" ? "$3" : "$20"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      <div className="bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔔</span>
          <p className="text-white font-bold text-sm">Sunday Notification Preview</p>
          <span className="ml-auto text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">9:00 PM</span>
        </div>
        <div className="bg-gray-700 rounded-xl p-3 space-y-1">
          <p className="text-white text-sm font-semibold">📚 ScholarRewards Weekly Summary</p>
          <p className="text-gray-300 text-xs">
            {isParent
              ? `Sarah earned ${weekNet} this week • Avg grade: ${avgGrade}% • ${missing.length} missing • ${makeupOpen.length} makeup windows open`
              : `You earned ${weekNet} this week! Avg: ${avgGrade}% • ${nextWeek.length} assignments due next week • ${makeupOpen.length} makeup windows still open`
            }
          </p>
          <p className="text-indigo-300 text-xs font-medium mt-1">Tap to view full summary →</p>
        </div>
      </div>

    </div>
  );
}
