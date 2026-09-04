import { useState } from "react";
import type { Assignment, NewAssignmentForm } from "../../types";
import { SUBJECTS } from "../../data/mockData";
import { getRewardStatus } from "../../lib/rewards";
import { getSubjectColor, getStatusBadge, getDaysLeftColor } from "../../lib/styles";

interface StudentDashboardProps {
  assignments: Assignment[];
  setAssignments: (assignments: Assignment[]) => void;
}

const TABS = ["all", "pending", "graded", "missing", "makeup"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_FORM: NewAssignmentForm = { title: "", subject: "Math", type: "assignment", dueDate: "", status: "pending", grade: "" };

export function StudentDashboard({ assignments, setAssignments }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newA, setNewA] = useState<NewAssignmentForm>(EMPTY_FORM);

  const filtered = activeTab === "all"
    ? assignments
    : activeTab === "makeup"
      ? assignments.filter(a => a.makeupAvailable)
      : assignments.filter(a => a.status === activeTab);

  function handleAdd() {
    const isTestQuiz = newA.type === "test" || newA.type === "quiz";
    const assignment: Assignment = {
      ...newA,
      id: assignments.length + 1,
      grade: newA.grade ? parseInt(newA.grade, 10) : null,
      daysLeft: 7,
      rewardValue: isTestQuiz ? 20 : 3,
    };
    setAssignments([...assignments, assignment]);
    setShowAddModal(false);
    setNewA(EMPTY_FORM);
  }

  return (
    <div className="pb-4">
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        {[
          { label: "Pending", val: assignments.filter(a => a.status === "pending").length, color: "text-indigo-600" },
          { label: "Completed", val: assignments.filter(a => a.status === "graded").length, color: "text-green-600" },
          { label: "Makeups", val: assignments.filter(a => a.makeupAvailable && (a.daysLeft ?? 0) > 0).length, color: "text-orange-500" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-3 shadow-sm text-center border border-gray-100">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {assignments.filter(a => a.makeupAvailable && (a.daysLeft ?? 0) <= 3).map(a => (
        <div key={a.id} className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-orange-700">{a.title}</p>
            <p className="text-xs text-orange-500">Makeup window closes in {a.daysLeft} day{a.daysLeft !== 1 ? "s" : ""}!</p>
          </div>
        </div>
      ))}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200"}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 space-y-3">
        {filtered.map(a => {
          const r = getRewardStatus(a);
          return (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-stretch">
                <div className={`w-1.5 ${getSubjectColor(a.subject)}`} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-500">{a.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(a.status)}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.type.charAt(0).toUpperCase() + a.type.slice(1)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${r.color}`}>{r.label ?? "—"}</p>
                      {a.grade !== null && <p className="text-xs text-gray-400 mt-0.5">{a.grade}%</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">Due: {a.dueDate}</p>
                    {a.makeupAvailable && (a.daysLeft ?? 0) > 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft ?? 0)}`}>⏱ {a.daysLeft}d left</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📋</p><p>No assignments here</p></div>}
      </div>
      <div className="fixed bottom-20 right-4">
        <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl text-2xl flex items-center justify-center">+</button>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add Assignment</h2><button onClick={() => setShowAddModal(false)} className="text-gray-400 text-xl">✕</button></div>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Assignment title" value={newA.title} onChange={e => setNewA({ ...newA, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.subject} onChange={e => setNewA({ ...newA, subject: e.target.value })}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
              <select className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.type} onChange={e => setNewA({ ...newA, type: e.target.value as NewAssignmentForm["type"] })}><option value="assignment">Assignment</option><option value="quiz">Quiz</option><option value="test">Test</option></select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.dueDate} onChange={e => setNewA({ ...newA, dueDate: e.target.value })} />
              <input type="number" className="border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Grade % (optional)" value={newA.grade} onChange={e => setNewA({ ...newA, grade: e.target.value })} />
            </div>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.status} onChange={e => setNewA({ ...newA, status: e.target.value as NewAssignmentForm["status"] })}><option value="pending">Pending</option><option value="graded">Graded</option><option value="missing">Missing</option></select>
            <button onClick={handleAdd} disabled={!newA.title || !newA.dueDate} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Add Assignment</button>
          </div>
        </div>
      )}
    </div>
  );
}
