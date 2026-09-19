import { useEffect, useState } from "react";
import type { Assignment, AssignmentStatus, AssignmentType } from "../../types";
import { SUBJECTS } from "../../data/mockData";
import {
  createAssignment, deleteAssignment, fetchAssignmentHistory, previewAssignmentUpdate, updateAssignment,
  type AssignmentImpact, type AssignmentInput, type HistoryEntry,
} from "../../lib/api";
import { plainMoney, shortDateTime, signedMoney } from "../../lib/money";

interface AssignmentEditorProps {
  /** null = add new work (parents can enter graded work directly). */
  assignment: Assignment | null;
  studentName: string;
  onClose: () => void;
  onSaved: (a: Assignment) => void;
  onDeleted: (id: string) => void;
}

interface Form {
  title: string;
  subject: string;
  type: AssignmentType;
  dueDate: string;
  status: AssignmentStatus;
  grade: string;
}

function toForm(a: Assignment | null): Form {
  return a
    ? { title: a.title, subject: a.subject, type: a.type, dueDate: a.dueDate, status: a.status, grade: a.grade !== null ? String(a.grade) : "" }
    : { title: "", subject: "Math", type: "assignment", dueDate: "", status: "pending", grade: "" };
}

/** null when the form can't be sent yet (a graded item needs a numeric grade). */
function toPayload(f: Form): AssignmentInput | null {
  const grade = f.status === "graded" ? Number(f.grade) : null;
  if (f.status === "graded" && (f.grade.trim() === "" || !Number.isFinite(grade))) return null;
  if (!f.title.trim() || !f.dueDate) return null;
  return { title: f.title.trim(), subject: f.subject, type: f.type, dueDate: f.dueDate, status: f.status, grade };
}

export function AssignmentEditor({ assignment, studentName, onClose, onSaved, onDeleted }: AssignmentEditorProps) {
  const isNew = assignment === null;
  const [form, setForm] = useState<Form>(() => toForm(assignment));
  const [impact, setImpact] = useState<AssignmentImpact | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = toPayload(form);
  const payloadKey = payload ? JSON.stringify(payload) : null;

  // Live preview of what saving would do to the ledger and balance (nothing is written).
  useEffect(() => {
    if (!assignment || !payloadKey) return;
    let cancelled = false;
    const t = setTimeout(() => {
      previewAssignmentUpdate(assignment.id, JSON.parse(payloadKey) as AssignmentInput)
        .then(i => { if (!cancelled) setImpact(i); })
        .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't preview this change"); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [assignment, payloadKey]);

  useEffect(() => {
    if (!assignment) return;
    fetchAssignmentHistory(assignment.id, 20).then(setHistory).catch(() => setHistory([]));
  }, [assignment]);

  async function handleSave() {
    if (!payload) return;
    setSaving(true);
    setError(null);
    try {
      const saved = assignment ? await updateAssignment(assignment.id, payload) : await createAssignment(payload);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!assignment) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAssignment(assignment.id);
      onDeleted(assignment.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setSaving(false);
    }
  }

  const input = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const unchanged = !isNew && impact !== null && !impact.changed;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{isNew ? "Add Work" : "Edit Assignment"}</h2>
            <p className="text-xs text-gray-400">for {studentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl" aria-label="Close">✕</button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <input className={input} placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <select className={input} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
            {[...new Set([...SUBJECTS, form.subject])].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className={input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AssignmentType })}>
            <option value="assignment">Assignment</option><option value="quiz">Quiz</option><option value="test">Test</option>
          </select>
        </div>
        <input type="date" className={input} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <select className={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as AssignmentStatus })}>
            <option value="pending">Pending</option><option value="graded">Graded</option><option value="missing">Missing</option>
          </select>
          <input
            type="number" min={0} max={200} className={`${input} disabled:bg-gray-50 disabled:text-gray-300`}
            placeholder="Grade %" disabled={form.status !== "graded"}
            value={form.status === "graded" ? form.grade : ""} onChange={e => setForm({ ...form, grade: e.target.value })}
          />
        </div>

        {!isNew && (
          <div className={`rounded-2xl p-3 text-sm ${impact && impact.delta !== 0 ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
            {impact === null ? (
              <p className="text-gray-400">Checking what this does to the balance…</p>
            ) : unchanged ? (
              <p className="text-gray-500">No changes yet.</p>
            ) : impact.delta === 0 ? (
              <p className="text-gray-600">This change doesn't affect the balance.</p>
            ) : (
              <div className="space-y-0.5">
                <p className="text-gray-700">Reward: <span className="font-semibold">{signedMoney(impact.ledgerBefore)} → {signedMoney(impact.ledgerAfter)}</span> ({signedMoney(impact.delta)})</p>
                <p className="text-gray-700">Balance: <span className="font-semibold">{plainMoney(impact.balanceBefore)} → {plainMoney(impact.balanceAfter)}</span></p>
                <p className="text-xs text-gray-400">Priced at today's reward amounts.</p>
              </div>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={!payload || saving || unchanged} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
          {saving ? "Saving…" : isNew ? "Add" : "Save Changes"}
        </button>

        {!isNew && (
          confirmDelete ? (
            <div className="bg-red-50 rounded-2xl p-3 space-y-2">
              <p className="text-sm text-red-700">
                Delete this for good? {assignment && assignment.recordedReward ? `Its ${signedMoney(assignment.recordedReward)} comes off the balance. ` : ""}The deletion is kept in the change history.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={saving} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-40">Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-white text-gray-600 py-2 rounded-xl text-sm border border-gray-200">Keep</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-semibold text-sm">Delete</button>
          )
        )}

        {!isNew && history.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">CHANGE HISTORY</p>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="text-xs text-gray-600 border-l-2 border-gray-100 pl-3">
                  <p>{h.summary}</p>
                  <p className="text-gray-400">
                    {h.actorName}{h.actorRole === "student" ? " (student)" : ""} · {shortDateTime(h.createdAt)}
                    {h.action === "update" && h.ledgerBefore !== h.ledgerAfter && <> · reward {signedMoney(h.ledgerBefore)} → {signedMoney(h.ledgerAfter)}</>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
