import { useMemo, useRef, useState } from "react";
import type { Assignment, AssignmentType } from "../../types";
import {
  createAssignment, fetchImportIgnores, fetchRewardSummary, ignoreImportItem, readScreenshots, unignoreImportItem, updateAssignment,
} from "../../lib/api";
import { fileToScreenshotUpload } from "../../lib/screenshotImage";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { GRADE_SOURCES } from "../../lib/import/sources";
import { buildPlan, estimateDelta, knownClasses, notInList, type IgnoreKey, type PlanKind, type PlanRow } from "../../lib/import/match";
import { importKey } from "../../lib/import/normalize";
import type { ImportedItem, SkippedLine } from "../../lib/import/types";

interface ImportModalProps {
  assignments: Assignment[];
  studentName: string;
  onClose: () => void;
  /** Called once after anything was saved, so the app reloads assignments and the balance. */
  onImported: () => void;
}

type Step = "paste" | "review" | "done";

interface Outcome {
  saved: number;
  failed: { title: string; error: string }[];
  balance: number | null;
}

const SECTIONS: { kind: PlanKind; title: string; hint: string }[] = [
  { kind: "new", title: "New", hint: "In Campus but not in the app" },
  { kind: "update", title: "Updates", hint: "Grade or status changed" },
  { kind: "locked", title: "Paid out — can't change", hint: "Fix these with ± Adjust on the Balance page" },
  { kind: "unchanged", title: "Already up to date", hint: "" },
  { kind: "ignored", title: "Ignored", hint: "You chose not to import these. They stay here on every import until you stop ignoring them." },
];
const COLLAPSIBLE: PlanKind[] = ["unchanged", "ignored"];

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

/** Parent-only: paste a school system's notification list, review what it would change, then save the ticked rows. */
export function ImportModal({ assignments, studentName, onClose, onImported }: ImportModalProps) {
  const fmt = useFormatAmount();
  const rules = useRewardSettings();
  const [sourceId, setSourceId] = useState(GRADE_SOURCES[0].id);
  const source = GRADE_SOURCES.find(s => s.id === sourceId) ?? GRADE_SOURCES[0];
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("paste");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [expanded, setExpanded] = useState<PlanKind[]>([]);
  const [items, setItems] = useState<ImportedItem[]>([]);
  // The modal's own copy, so a "Same assignment" rename shows immediately without waiting for the app to reload.
  const [appAssignments, setAppAssignments] = useState<Assignment[]>(assignments);
  const [ignores, setIgnores] = useState<IgnoreKey[]>([]);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => rows.filter(r => r.selected), [rows]);
  const estimate = useMemo(() => selected.reduce((sum, r) => sum + estimateDelta(r, rules), 0), [selected, rules]);
  const missingFromList = useMemo(() => (complete ? notInList(rows, appAssignments) : []), [complete, rows, appAssignments]);

  async function review(input: string) {
    const result = source.parse(input, knownClasses(appAssignments));
    // If the ignore list can't load, show everything rather than block the import.
    const saved = await fetchImportIgnores().catch(err => { console.error("Failed to load ignored imports", err); return []; });
    setItems(result.items);
    setIgnores(saved);
    setRows(buildPlan(result.items, appAssignments, saved));
    setSkipped(result.skipped);
    setComplete(result.complete);
    setRowError(null);
    setStep("review");
  }

  /** Re-match after an ignore/rename, keeping the parent's ticks and type choices on rows that didn't change kind. */
  function rebuild(nextAssignments: Assignment[], nextIgnores: IgnoreKey[]) {
    setRows(prev => {
      const before = new Map(prev.map(r => [importKey(r.item.className, r.item.title), r]));
      return buildPlan(items, nextAssignments, nextIgnores).map(r => {
        const old = before.get(importKey(r.item.className, r.item.title));
        return old && old.kind === r.kind ? { ...r, selected: old.selected, type: old.type } : r;
      });
    });
  }

  async function rowAction(i: number, action: () => Promise<void>) {
    setBusyRow(i);
    setRowError(null);
    try {
      await action();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "That didn't work — try again");
    } finally {
      setBusyRow(null);
    }
  }

  const handleIgnore = (r: PlanRow, i: number) => rowAction(i, async () => {
    const entry = await ignoreImportItem(r.item.className, r.item.title);
    const next = [...ignores.filter(x => x.id !== entry.id), entry];
    setIgnores(next);
    rebuild(appAssignments, next);
  });

  const handleUnignore = (r: PlanRow, i: number) => rowAction(i, async () => {
    await unignoreImportItem(r.ignoreId!);
    const next = ignores.filter(x => x.id !== r.ignoreId);
    setIgnores(next);
    rebuild(appAssignments, next);
  });

  // The app's item and the school's are the same assignment: take the school's name so future imports match exactly.
  // Only the title changes, so the reward doesn't.
  const handleSameAs = (r: PlanRow, i: number) => rowAction(i, async () => {
    const renamed = await updateAssignment(r.similar!.id, { title: r.item.title });
    const next = appAssignments.map(a => (a.id === renamed.id ? renamed : a));
    setAppAssignments(next);
    rebuild(next, ignores);
    onImported();
  });

  async function handleScreenshots(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading(true);
    setReadError(null);
    setReadNote(null);
    try {
      const uploads = await Promise.all([...files].slice(0, 8).map(fileToScreenshotUpload));
      const result = await readScreenshots(uploads);
      if (!result.text.trim()) {
        setReadError("No notifications could be read from that. Make sure the notification list is open and readable in the screenshot.");
        return;
      }
      // Keep anything already pasted; the parser de-duplicates overlapping screenshots.
      const combined = [text.trim(), result.text].filter(Boolean).join("\n");
      setText(combined);
      setReadNote(
        `Read ${uploads.length} screenshot${uploads.length === 1 ? "" : "s"}.` +
          (files.length > 8 ? " Only the first 8 were used." : "") +
          (result.truncated ? " The list was very long and may be cut off — try fewer screenshots at a time." : ""),
      );
      review(combined);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read the screenshots");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function patchRow(i: number, patch: Partial<PlanRow>) {
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleImport() {
    setSaving(true);
    setProgress(0);
    const failed: Outcome["failed"] = [];
    let saved = 0;
    // One at a time: each save re-prices that item and writes its history, exactly like entering it by hand.
    for (const r of selected) {
      const fields = { status: r.item.status, grade: r.item.status === "graded" ? r.item.grade : null, type: r.type };
      try {
        if (r.existing) await updateAssignment(r.existing.id, fields);
        else await createAssignment({ title: r.item.title, subject: r.item.className, dueDate: r.item.date ?? today(), ...fields });
        saved++;
      } catch (err) {
        failed.push({ title: r.item.title, error: err instanceof Error ? err.message : "Failed" });
      }
      setProgress(p => p + 1);
    }
    const balance = await fetchRewardSummary().then(s => s.balance).catch(() => null);
    if (saved > 0) onImported();
    setOutcome({ saved, failed, balance });
    setSaving(false);
    setStep("done");
  }

  const input = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const label = "block text-xs font-medium text-gray-500 mb-1";

  function rowView(r: PlanRow, i: number) {
    const selectable = r.kind === "new" || r.kind === "update";
    const result = r.item.status === "graded" ? `${r.item.grade}%` : r.item.status === "missing" ? "Missing" : "No score yet";
    return (
      <div key={i} className={`flex items-start gap-3 px-4 py-3 ${r.selected ? "" : "opacity-70"}`}>
        {selectable ? (
          <input type="checkbox" checked={r.selected} onChange={e => patchRow(i, { selected: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" aria-label={`Import ${r.item.title}`} />
        ) : (
          <span className="mt-0.5 w-4 shrink-0 text-center text-sm">{r.kind === "locked" ? "🔒" : r.kind === "ignored" ? "–" : "✓"}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 break-words">{r.item.title}</p>
            <p className={`text-sm font-bold shrink-0 ${r.item.status === "missing" ? "text-red-500" : r.item.status === "pending" ? "text-gray-400" : "text-gray-700"}`}>{result}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{r.item.className}</span>
            {r.item.points && <span className="text-xs text-gray-400">{r.item.points.earned} / {r.item.points.possible} pts</span>}
            {r.item.flags.map(f => (
              <span key={f} className="text-xs px-2 py-0.5 rounded-full border border-orange-200 text-orange-600 font-medium capitalize">{f}</span>
            ))}
            {r.kind === "new" && <span className="text-xs text-gray-400">Due {r.item.date ?? "today"}{r.item.dueDateExact ? "" : " (approx.)"}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{r.note}</p>
          {(r.kind === "new" || r.kind === "ignored") && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {r.kind === "new" && r.similar && (
                <button onClick={() => handleSameAs(r, i)} disabled={busyRow !== null}
                  className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-lg disabled:opacity-40">
                  {busyRow === i ? "Saving…" : "Same assignment — use this name"}
                </button>
              )}
              {r.kind === "new" && (
                <button onClick={() => handleIgnore(r, i)} disabled={busyRow !== null}
                  className="text-xs bg-gray-100 text-gray-600 font-medium px-2.5 py-1 rounded-lg disabled:opacity-40">
                  {busyRow === i && !r.similar ? "Saving…" : "Ignore"}
                </button>
              )}
              {r.kind === "ignored" && (
                <button onClick={() => handleUnignore(r, i)} disabled={busyRow !== null}
                  className="text-xs bg-gray-100 text-gray-600 font-medium px-2.5 py-1 rounded-lg disabled:opacity-40">
                  {busyRow === i ? "Saving…" : "Stop ignoring"}
                </button>
              )}
            </div>
          )}
          {selectable && r.selected && (
            <select value={r.type} onChange={e => patchRow(i, { type: e.target.value as AssignmentType })}
              aria-label={`Type for ${r.item.title}`}
              className="mt-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
              <option value="assignment">Assignment</option><option value="quiz">Quiz</option><option value="test">Test</option>
            </select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-lg max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Import Grades</h2>
            <p className="text-xs text-gray-400">for {studentName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-gray-400 text-xl disabled:opacity-30" aria-label="Close">✕</button>
        </div>

        {step === "paste" && (
          <>
            {GRADE_SOURCES.length > 1 && (
              <div>
                <label htmlFor="import-source" className={label}>School system</label>
                <select id="import-source" className={input} value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  {GRADE_SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <p className="text-sm text-gray-500">{source.instructions}</p>

            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleScreenshots(e.target.files)} />
            <button onClick={() => fileInput.current?.click()} disabled={reading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
              {reading ? "Reading screenshots… (about 10–30 seconds)" : "📷 Upload screenshots"}
            </button>
            <p className="text-xs text-gray-400">
              Up to 8 at a time. Overlapping screenshots are fine — repeats are merged. Screenshots are read by Claude (AI) and not stored.
            </p>
            {readError && <p className="text-sm text-red-500">{readError}</p>}

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />or paste the text<span className="h-px flex-1 bg-gray-200" />
            </div>
            <div>
              <label htmlFor="import-text" className={label}>Pasted {source.name} notifications</label>
              <textarea id="import-text" rows={10} className={`${input} font-mono text-xs`} value={text} onChange={e => setText(e.target.value)}
                placeholder={`${studentName} received a score of 8 out of 10 on Concept Check 1.2 in Geometry\n…`} />
            </div>
            <p className="text-xs text-gray-400">Nothing is saved until you review the list and tap Import.</p>
            <button onClick={() => review(text)} disabled={!text.trim() || reading} className="w-full bg-white text-indigo-700 border border-indigo-200 py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
              Review
            </button>
          </>
        )}

        {step === "review" && (
          <>
            {readNote && <p className="text-xs text-gray-400">{readNote} Tap ‹ Back to see the text that was read.</p>}
            {rows.length === 0 ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-gray-700">
                No score or missing notifications found in that text. Make sure you copied the {source.name} notification list itself.
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Found {rows.length} item{rows.length === 1 ? "" : "s"}. Ticked rows will be saved; set the type for anything that's a quiz or test.
              </p>
            )}

            {rowError && <p className="text-sm text-red-500">{rowError}</p>}

            {SECTIONS.map(sec => {
              const list = rows.map((r, i) => [r, i] as const).filter(([r]) => r.kind === sec.kind);
              if (list.length === 0) return null;
              const collapsible = COLLAPSIBLE.includes(sec.kind);
              const collapsed = collapsible && !expanded.includes(sec.kind);
              return (
                <div key={sec.kind} className="rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => collapsible && setExpanded(v => (v.includes(sec.kind) ? v.filter(k => k !== sec.kind) : [...v, sec.kind]))}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-left">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{sec.title} ({list.length})</p>
                      {sec.hint && <p className="text-xs text-gray-400">{sec.hint}</p>}
                    </div>
                    {collapsible && <span className="text-xs text-indigo-600">{collapsed ? "Show" : "Hide"}</span>}
                  </button>
                  {!collapsed && <div className="divide-y divide-gray-50">{list.map(([r, i]) => rowView(r, i))}</div>}
                </div>
              );
            })}

            {missingFromList.length > 0 && (
              <details className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer">In the app but not in this list ({missingFromList.length})</summary>
                <p className="text-xs text-gray-500 mt-1">Renamed, dropped, or entered by mistake? Nothing here changes on import — open it from the Balance page if it needs fixing.</p>
                <div className="mt-2 space-y-1">
                  {missingFromList.map(x => (
                    <p key={x.id} className="text-xs text-gray-600">
                      <span className="font-medium">{x.title}</span> · {x.subject} · {x.status === "graded" ? `${x.grade}%` : x.status}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {skipped.length > 0 && (
              <details className="rounded-2xl border border-gray-100 px-4 py-2.5">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Skipped ({skipped.length})</summary>
                <div className="mt-2 space-y-2">
                  {skipped.map((s, i) => (
                    <div key={i} className="text-xs">
                      <p className="text-gray-600 break-words">{s.raw}</p>
                      <p className="text-gray-400">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {selected.length > 0 && estimate !== 0 && (
              <p className="text-sm text-gray-600 text-center">
                Estimated balance change: <span className={`font-semibold ${estimate > 0 ? "text-green-600" : "text-red-500"}`}>{fmt(estimate, { signed: true })}</span>
                <span className="block text-xs text-gray-400">At today's reward amounts; the exact amount is set when each item saves.</span>
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep("paste")} disabled={saving} className="flex-1 bg-white text-gray-600 py-3 rounded-xl text-sm border border-gray-200 disabled:opacity-40">
                ‹ Back
              </button>
              <button onClick={handleImport} disabled={selected.length === 0 || saving}
                className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
                {saving ? `Saving ${progress} of ${selected.length}…` : `Import ${selected.length}`}
              </button>
            </div>
          </>
        )}

        {step === "done" && outcome && (
          <>
            <div className={`rounded-2xl p-4 text-sm ${outcome.failed.length ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
              <p className="font-semibold text-gray-800">Saved {outcome.saved} item{outcome.saved === 1 ? "" : "s"}.</p>
              {outcome.balance !== null && <p className="text-gray-600">{studentName}'s balance is now {fmt(outcome.balance)}.</p>}
            </div>
            {outcome.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-600">{outcome.failed.length} couldn't be saved:</p>
                {outcome.failed.map((f, i) => (
                  <p key={i} className="text-xs text-gray-600"><span className="font-medium">{f.title}</span> — {f.error}</p>
                ))}
              </div>
            )}
            <button onClick={onClose} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">Done</button>
          </>
        )}
      </div>
    </div>
  );
}
