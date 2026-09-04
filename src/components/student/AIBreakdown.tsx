import { useState } from "react";
import type { AssignmentPlan, AssignmentPlanForm } from "../../types";
import { SUBJECTS } from "../../data/mockData";

type Step = "form" | "plan";

const EMPTY_FORM: AssignmentPlanForm = { title: "", subject: "English", type: "assignment", dueDate: "", details: "" };

const EXAMPLES: { title: string; subject: string; type: string }[] = [
  { title: "10-page research paper on WW2", subject: "History", type: "research paper" },
  { title: "Study for Algebra midterm exam", subject: "Math", type: "test" },
  { title: "Book report on To Kill a Mockingbird", subject: "English", type: "essay" },
];

export function AIBreakdown() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AssignmentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentPlanForm>(EMPTY_FORM);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // NOTE: calls api.anthropic.com directly from the browser with no key —
  // this needs a real backend proxy route before it can work outside the
  // Claude.ai artifact sandbox (see project TODO: AI task breakdown).
  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const prompt = `You are an academic coach helping a high school student break down a big assignment into a manageable step-by-step plan.

Assignment: "${form.title}"
Subject: ${form.subject}
Type: ${form.type}
Due Date: ${form.dueDate}
Today's Date: ${today}
Extra details: ${form.details || "None"}

Create a realistic day-by-day action plan to complete this assignment successfully.
Respond ONLY with a valid JSON object in this exact format, no extra text, no markdown:
{
  "summary": "One sentence overview of the approach",
  "estimatedHours": 4,
  "steps": [
    {
      "day": "Monday, Mar 11",
      "task": "What to do this day",
      "duration": "30 min",
      "tip": "A helpful tip for this step"
    }
  ]
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content.map((b: { text?: string }) => b.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed: AssignmentPlan = JSON.parse(clean);
      setPlan(parsed);
      setCheckedSteps({});
      setStep("plan");
    } catch {
      setError("Couldn't generate plan. Please try again.");
    }
    setLoading(false);
  }

  function toggleStep(i: number) {
    setCheckedSteps(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
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
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
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
              disabled={!form.title || !form.dueDate || loading}
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
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Try an example</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => setForm({ ...form, title: ex.title, subject: ex.subject, type: ex.type })}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-violet-50 rounded-xl text-sm text-gray-600 hover:text-violet-700 transition-all border border-transparent hover:border-violet-200">
                  <span className="font-medium">{ex.title}</span>
                  <span className="text-gray-400 ml-2">• {ex.subject}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === "plan" && plan && (
        <>
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-violet-300 font-semibold uppercase tracking-wide mb-1">{form.subject} • {form.type}</p>
                <p className="font-bold text-lg leading-tight">{form.title}</p>
                <p className="text-violet-200 text-xs mt-1">Due {form.dueDate} • ~{plan.estimatedHours}h total</p>
              </div>
              <button onClick={() => setStep("form")}
                className="bg-white bg-opacity-20 rounded-xl px-3 py-1.5 text-xs font-semibold ml-3 shrink-0">
                New Plan
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
            {progress === 100 && (
              <p className="text-center text-green-600 font-bold text-sm mt-2">🎉 Assignment Complete!</p>
            )}
          </div>

          <div className="space-y-3">
            {plan.steps.map((s, i) => (
              <div key={i}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${checkedSteps[i] ? "border-green-200 opacity-70" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => toggleStep(i)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${checkedSteps[i] ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {checkedSteps[i] && <span className="text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">{s.day}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏱ {s.duration}</span>
                    </div>
                    <p className={`text-sm font-semibold ${checkedSteps[i] ? "line-through text-gray-400" : "text-gray-800"}`}>{s.task}</p>
                    {!checkedSteps[i] && s.tip && (
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
        </>
      )}
    </div>
  );
}
