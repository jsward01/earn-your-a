import { useEffect, useMemo, useState } from "react";
import type { Assignment, AssignmentPlanForm, SavedPlan } from "../../types";
import { deletePlan, fetchPlans, generateAssignmentPlan, setPlanChecked } from "../../lib/api";
import { subjectOptions } from "../../lib/subjects";
import { formatDay } from "../../lib/dates";
import { SubjectPicker } from "../shared/SubjectPicker";

type Step = "form" | "plan";

const EMPTY_FORM: AssignmentPlanForm = { title: "", subject: "", type: "assignment", dueDate: "", details: "" };

const EXAMPLES: { title: string; subject: string; type: string }[] = [
  { title: "10-page research paper on WW2", subject: "History", type: "research paper" },
  { title: "Study for Algebra midterm exam", subject: "Math", type: "test" },
  { title: "Book report on To Kill a Mockingbird", subject: "English", type: "essay" },
];

export function AIBreakdown({ assignments }: { assignments: Assignment[] }) {
  const subjects = useMemo(() => subjectOptions(assignments), [assignments]);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentPlanForm>(EMPTY_FORM);
  // Saved plans, newest first (null while loading). `openId` is the one on screen.
  const [plans, setPlans] = useState<SavedPlan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(err => { setPlans([]); setPlansError(err instanceof Error ? err.message : "Couldn't load your plans."); });
  }, []);

  const current = plans?.find(p => p.id === openId) ?? null;
  const plan = current?.plan ?? null;

  function replacePlan(updated: SavedPlan) {
    setPlans(prev => prev?.map(p => (p.id === updated.id ? updated : p)) ?? prev);
  }

  function openPlan(id: string) {
    setOpenId(id);
    setPlanError(null);
    setStep("plan");
  }

  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const saved = await generateAssignmentPlan(form);
      setPlans(prev => [saved, ...(prev ?? [])]);
      setForm({ ...EMPTY_FORM, subject: form.subject });
      openPlan(saved.id);
    } catch (err) {
      // The server's message says what went wrong (e.g. the family's daily limit), so show it.
      setError(err instanceof Error ? err.message : "Couldn't generate plan. Please try again.");
    }
    setLoading(false);
  }

  async function toggleStep(i: number) {
    if (!current) return;
    const before = current;
    const checked = before.checked.includes(i) ? before.checked.filter(x => x !== i) : [...before.checked, i].sort((a, b) => a - b);
    replacePlan({ ...before, checked }); // show the tick right away; put it back if saving fails
    setPlanError(null);
    try {
      replacePlan(await setPlanChecked(before.id, checked));
    } catch (err) {
      replacePlan(before);
      setPlanError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    }
  }

  async function removePlan() {
    if (!current) return;
    try {
      await deletePlan(current.id);
      setPlans(prev => prev?.filter(p => p.id !== current.id) ?? prev);
      setConfirmDelete(false);
      setOpenId(null);
      setStep("form");
    } catch (err) {
      setConfirmDelete(false);
      setPlanError(err instanceof Error ? err.message : "Couldn't delete the plan. Please try again.");
    }
  }

  const isChecked = (i: number) => current?.checked.includes(i) ?? false;
  const completedCount = current?.checked.length ?? 0;
  const totalSteps = plan?.steps?.length ?? 0;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className="pb-28 px-4 pt-4 space-y-4">
      {step === "form" && (
        <>
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🤖</span>
              <div>
                <p className="font-bold text-lg">AI Assignment Planner</p>
                <p className="text-violet-200 text-xs">Break any assignment into a step-by-step plan</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignment Title</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="e.g. Research paper on the Civil War"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</label>
                <div className="mt-1">
                  <SubjectPicker options={subjects} value={form.subject} onChange={subject => setForm({ ...form, subject })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="assignment">Assignment</option>
                  <option value="essay">Essay</option>
                  <option value="research paper">Research Paper</option>
                  <option value="project">Project</option>
                  <option value="test">Test / Exam</option>
                  <option value="quiz">Quiz</option>
                  <option value="presentation">Presentation</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extra Details <span className="text-gray-300 font-normal">(optional)</span></label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                rows={3}
                placeholder="e.g. Must be 5 pages, MLA format, needs 3 sources, teacher wants an outline first..."
                value={form.details}
                onChange={e => setForm({ ...form, details: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              onClick={generatePlan}
              disabled={!form.title || !form.subject.trim() || !form.dueDate || loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Building your plan...
                </>
              ) : (
                <> 🤖 Generate My Plan </>
              )}
            </button>
            {loading && <BuildingPanel />}
          </div>

          {plans && plans.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Your plans</p>
              <div className="space-y-2">
                {plans.map(p => (
                  <button key={p.id} onClick={() => openPlan(p.id)}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-200 transition-all flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-700 truncate">{p.title}</span>
                      <span className="block text-xs text-gray-400 truncate">{p.subject} • Due {formatDay(p.dueDate)}</span>
                    </span>
                    <span className={`text-xs font-bold shrink-0 ${p.checked.length === p.plan.steps.length ? "text-green-600" : "text-violet-600"}`}>
                      {p.checked.length === p.plan.steps.length ? "✓ Done" : `${p.checked.length}/${p.plan.steps.length}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {plansError && <p className="text-sm text-red-500 text-center">{plansError}</p>}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Try an example</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => setForm({ ...form, title: ex.title, type: ex.type, subject: subjects.includes(ex.subject) ? ex.subject : form.subject })}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-violet-50 rounded-xl text-sm text-gray-600 hover:text-violet-700 transition-all border border-transparent hover:border-violet-200">
                  <span className="font-medium">{ex.title}</span>
                  <span className="text-gray-400 ml-2">• {ex.subject}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === "plan" && current && plan && (
        <>
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-violet-300 font-semibold uppercase tracking-wide mb-1">{current.subject} • {current.type}</p>
                <p className="font-bold text-lg leading-tight">{current.title}</p>
                <p className="text-violet-200 text-xs mt-1">Due {formatDay(current.dueDate)} • ~{plan.estimatedHours}h total</p>
              </div>
              <button onClick={() => setStep("form")}
                className="bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold ml-3 shrink-0">
                ‹ All Plans
              </button>
            </div>
            <p className="text-violet-100 text-sm mt-3 leading-relaxed">{plan.summary}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold text-gray-700">Your Progress</p>
              <p className="text-sm font-bold text-violet-600">{completedCount}/{totalSteps} steps</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            {planError && <p className="text-sm text-red-500 text-center mt-2">{planError}</p>}
            {progress === 100 && (
              <p className="text-center text-green-600 font-bold text-sm mt-2">🎉 Assignment Complete!</p>
            )}
          </div>

          <div className="space-y-3">
            {plan.steps.map((s, i) => (
              <div key={i}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${isChecked(i) ? "border-green-200 opacity-70" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => toggleStep(i)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isChecked(i) ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {isChecked(i) && <span className="text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">{s.day}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏱ {s.duration}</span>
                    </div>
                    <p className={`text-sm font-semibold ${isChecked(i) ? "line-through text-gray-400" : "text-gray-800"}`}>{s.task}</p>
                    {!isChecked(i) && s.tip && (
                      <div className="mt-2 flex items-start gap-1.5 bg-violet-50 rounded-xl px-3 py-2">
                        <span className="text-sm">💡</span>
                        <p className="text-xs text-violet-700">{s.tip}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep("form")}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            🤖 Plan Another Assignment
          </button>
          <button onClick={() => setConfirmDelete(true)} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-semibold text-sm">
            Delete This Plan
          </button>
        </>
      )}

      {confirmDelete && current && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 text-center">
            <h2 id="delete-plan-title" className="text-lg font-bold text-gray-800">Delete this plan?</h2>
            <p className="text-sm text-gray-500">"{current.title}" and its checked-off steps will be gone for good.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm">Keep it</button>
              <button onClick={removePlan} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shown while the AI works: a plan can take a minute or more, so show that it's still going and for how long. */
function BuildingPanel() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const message =
    seconds < 15 ? "Reading your assignment…" : seconds < 40 ? "Working out the steps…" : seconds < 75 ? "Fitting it around your due date…" : "Almost there — big assignments take a little longer…";

  return (
    <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-700">{message}</p>
          <p className="text-xs text-violet-500">This usually takes about a minute. Keep this page open. ({seconds}s)</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
        <div className="progress-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
      </div>
    </div>
  );
}
