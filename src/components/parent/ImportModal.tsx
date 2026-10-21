import { useMemo, useRef, useState } from "react";
import type { Assignment, AssignmentType } from "../../types";
import {
  createAssignment, deleteAssignments, extractGrades, fetchAssignments, fetchClassSettings, fetchImportIgnores, setRewardsStart,
  fetchRewardSummary, ignoreImportItem, unignoreImportItem, updateAssignment, type ClassSetting,
} from "../../lib/api";
import { ClassSettingModal } from "./ClassSettingModal";
import { fileToScreenshotUpload } from "../../lib/screenshotImage";
import { formatDay } from "../../lib/dates";
import { useFormatAmount, useRewardSettings } from "../../lib/rewardSettingsContext";
import { detectFormat } from "../../lib/import/sources";
import { buildPlan, classCounts, estimateDelta, knownClasses, notInList, type ClassModes, type IgnoreKey, type PlanKind, type PlanRow } from "../../lib/import/match";
import { classKey, importKey } from "../../lib/import/normalize";
import type { ImportedItem, ParseResult, SkippedLine } from "../../lib/import/types";
import { fromExtracted } from "../../lib/import/other";

interface ImportModalProps {
  assignments: Assignment[];
  studentName: string;
  studentId: string | null;
  /** When rewards started for this student; null = never set, so the first import asks. */
  rewardsStartDate: string | null;
  onClose: () => void;
  /** Called once after anything was saved, so the app reloads assignments and the balance. */
  onImported: () => void;
}

type Step = "start" | "paste" | "review" | "done";

interface Outcome {
  saved: number;
  failed: { title: string; error: string }[];
  balance: number | null;
}

const SECTIONS: { kind: PlanKind; title: string; hint: string }[] = [
  { kind: "new", title: "New", hint: "In this list but not in the app" },
  { kind: "update", title: "Updates", hint: "Grade or status changed" },
  { kind: "locked", title: "Paid out — can't change", hint: "Fix these with ± Adjust on the Balance page" },
  { kind: "unchanged", title: "Already up to date", hint: "" },
  { kind: "ignored", title: "Ignored", hint: "You chose not to import these. They stay here on every import until you stop ignoring them." },
  { kind: "excluded", title: "Left out — class excluded", hint: "Tap the class under “Classes in this list” to change that." },
];
const COLLAPSIBLE: PlanKind[] = ["unchanged", "ignored", "excluded"];

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

const modesOf = (classes: ClassSetting[]): ClassModes => Object.fromEntries(classes.map(c => [c.classKey, c.mode]));

/** Parent-only: paste a school system's notification list, review what it would change, then save the ticked rows. */
export function ImportModal({ assignments, studentName, studentId, rewardsStartDate, onClose, onImported }: ImportModalProps) {
  const fmt = useFormatAmount();
  const rules = useRewardSettings();
  const [text, setText] = useState("");
  // Asked once per student, before their first import: when do rewards start?
  const [startDate, setStartDate] = useState<string | null>(rewardsStartDate);
  const [step, setStep] = useState<Step>(rewardsStartDate || !studentId ? "paste" : "start");
  const [startChoice, setStartChoice] = useState<"today" | "earlier">("today");
  const [earlierDate, setEarlierDate] = useState("");
  const [savingStart, setSavingStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
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
  const [classSettings, setClassSettings] = useState<ClassSetting[]>([]);
  // The class whose Pays / Track only / Leave out pop-up is open.
  const [editingClass, setEditingClass] = useState<string | null>(null);
  // Just left a class out, and the app already has unpaid work in it: offer to delete that too.
  const [cleanup, setCleanup] = useState<{ className: string; items: Assignment[]; paidOut: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  // What's being read right now (text by the AI reader, or screenshots), so each button shows its own progress.
  const [reading, setReading] = useState<"text" | "screenshots" | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  // How the last review was read: a dedicated parser's name, or the AI reader. Shown so a misread is easy to spot.
  const [readAs, setReadAs] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => rows.filter(r => r.selected), [rows]);
  const estimate = useMemo(() => selected.reduce((sum, r) => sum + estimateDelta(r, rules), 0), [selected, rules]);
  const missingFromList = useMemo(() => (complete ? notInList(rows, appAssignments) : []), [complete, rows, appAssignments]);

  /** Show the checklist for a parse result (from a local parser or the AI reader). */
  async function showReview(result: ParseResult) {
    // If the ignore list can't load, show everything rather than block the import.
    const [saved, left] = await Promise.all([
      fetchImportIgnores().catch(err => { console.error("Failed to load ignored imports", err); return []; }),
      fetchClassSettings().then(s => s.classes).catch(err => { console.error("Failed to load class settings", err); return []; }),
    ]);
    setItems(result.items);
    setIgnores(saved);
    setClassSettings(left);
    setCleanup(null);
    setRows(buildPlan(result.items, appAssignments, saved, startDate, modesOf(left)));
    setSkipped(result.skipped);
    setComplete(result.complete);
    setRowError(null);
    setStep("review");
  }

  /** Re-match after an ignore/rename, keeping the parent's ticks and type choices on rows that didn't change kind. */
  function rebuild(nextAssignments: Assignment[], nextIgnores: IgnoreKey[], nextClasses: ClassSetting[] = classSettings) {
    setRows(prev => {
      const before = new Map(prev.map(r => [importKey(r.item.className, r.item.title), r]));
      return buildPlan(items, nextAssignments, nextIgnores, startDate, modesOf(nextClasses)).map(r => {
        const old = before.get(importKey(r.item.className, r.item.title));
        return old && old.kind === r.kind ? { ...r, selected: old.selected, type: old.type } : r;
      });
    });
  }

  async function handleStartDate() {
    const date = startChoice === "today" ? today() : earlierDate;
    if (!studentId || !date) return;
    setSavingStart(true);
    setStartError(null);
    try {
      setStartDate(await setRewardsStart(studentId, date));
      onImported(); // refresh the app's copy of the summary, so the question isn't asked again
      setStep("paste");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't save the date");
    } finally {
      setSavingStart(false);
    }
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

  /** A class's setting was saved in its pop-up: re-match, and after Leave out offer to delete its unpaid work. */
  async function handleClassSaved(className: string, next: ClassSetting[], changedExisting: boolean) {
    const key = classKey(className);
    const wasLeftOut = classSettings.some(c => c.classKey === key && c.mode === "leave_out");
    const leftOut = next.some(c => c.classKey === key && c.mode === "leave_out");
    setClassSettings(next);
    let nextAssignments = appAssignments;
    if (changedExisting) {
      // Work already in the app was re-priced: reload it so the review's estimate starts from the new amounts.
      nextAssignments = await fetchAssignments().catch(() => appAssignments);
      setAppAssignments(nextAssignments);
      onImported();
    }
    rebuild(nextAssignments, ignores, next);
    if (leftOut && !wasLeftOut) {
      const inApp = nextAssignments.filter(a => classKey(a.subject) === key);
      const unpaid = inApp.filter(a => !a.payoutId);
      setCleanup(unpaid.length > 0 ? { className, items: unpaid, paidOut: inApp.length - unpaid.length } : null);
    } else if (cleanup && classKey(cleanup.className) === key) {
      setCleanup(null);
    }
  }

  async function handleCleanup() {
    if (!cleanup) return;
    setCleaning(true);
    setRowError(null);
    try {
      const { deleted } = await deleteAssignments(cleanup.items.map(a => a.id));
      const gone = new Set(deleted);
      const next = appAssignments.filter(a => !gone.has(a.id));
      setAppAssignments(next);
      rebuild(next, ignores);
      setCleanup(null);
      onImported();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't delete them — try again");
    } finally {
      setCleaning(false);
    }
  }

  // The app's item and the school's are the same assignment: take the school's name so future imports match exactly.
  // Only the title changes, so the reward doesn't.
  const handleSameAs = (r: PlanRow, i: number) => rowAction(i, async () => {
    const renamed = await updateAssignment(r.similar!.id, { title: r.item.title });
    const next = appAssignments.map(a => (a.id === renamed.id ? renamed : a));
    setAppAssignments(next);
    rebuild(next, ignores);
    onImported();
  });

  /** Review pasted text: a dedicated parser runs instantly if it recognizes the layout; otherwise the AI reads it. */
  async function review(input: string) {
    setReadError(null);
    setReadNote(null);
    const detected = detectFormat(input, knownClasses(appAssignments));
    if (detected) {
      setReadAs(`${detected.source.name} (instant)`);
      return showReview(detected.result);
    }
    setReading("text");
    try {
      const extracted = await extractGrades({ text: input });
      setReadAs("AI (Claude)");
      await showReview(fromExtracted(extracted, knownClasses(appAssignments)));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read that");
    } finally {
      setReading(null);
    }
  }

  /** Screenshots from any school system: Claude reads them straight into assignments (plus any text already pasted). */
  async function handleScreenshots(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading("screenshots");
    setReadError(null);
    setReadNote(null);
    try {
      const uploads = await Promise.all([...files].slice(0, 8).map(fileToScreenshotUpload));
      const extracted = await extractGrades({ text: text.trim() || undefined, images: uploads });
      setReadAs("AI (Claude)");
      setReadNote(`Read ${uploads.length} screenshot${uploads.length === 1 ? "" : "s"}.` + (files.length > 8 ? " Only the first 8 were used." : ""));
      await showReview(fromExtracted(extracted, knownClasses(appAssignments)));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read the screenshots");
    } finally {
      setReading(null);
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
          <span className="mt-0.5 w-4 shrink-0 text-center text-sm">{r.kind === "locked" ? "🔒" : r.kind === "ignored" || r.kind === "excluded" ? "–" : "✓"}</span>
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

        {step === "start" && (
          <>
            <div>
              <p className="text-base font-semibold text-gray-800">When should rewards start for {studentName}?</p>
              <p className="text-sm text-gray-500 mt-1">
                Older work still comes in so you can see grades and averages for the whole year — it just doesn't earn or cost anything.
                You only answer this once; you can change it later in Settings.
              </p>
            </div>
            <div className="space-y-2" role="radiogroup" aria-label="Rewards start">
              {([
                ["today", `Today (${formatDay(today())})`, "Only work due from today on earns rewards"],
                ["earlier", "An earlier date", "For example, the first day of school or of this semester"],
              ] as const).map(([value, title, hint]) => (
                <button key={value} role="radio" aria-checked={startChoice === value} onClick={() => setStartChoice(value)}
                  className={`w-full text-left rounded-xl border px-4 py-3 ${startChoice === value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"}`}>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{hint}</p>
                </button>
              ))}
            </div>
            {startChoice === "earlier" && (
              <div>
                <label htmlFor="rewards-start" className={label}>Rewards start on</label>
                <input id="rewards-start" type="date" max={today()} className={input} value={earlierDate} onChange={e => setEarlierDate(e.target.value)} />
              </div>
            )}
            {startError && <p className="text-sm text-red-500">{startError}</p>}
            <button onClick={handleStartDate} disabled={savingStart || (startChoice === "earlier" && !earlierDate)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
              {savingStart ? "Saving…" : "Continue"}
            </button>
          </>
        )}

        {step === "paste" && (
          <>
            <p className="text-sm text-gray-500">
              In your school's parent or student portal, open the page that lists each assignment with its score (often Grades or
              Assignments). Select it all, copy, and paste below — or upload screenshots of it.
            </p>
            <p className="text-xs text-gray-400">
              Infinite Campus: Grades → Assignments works best (it has real due dates and upcoming work). Other portals are read by
              Claude (AI) — double-check the points on each row.
            </p>
            {startDate && (
              <p className="text-xs text-gray-400">
                Rewards for {studentName} started {formatDay(startDate)}; anything due earlier comes in as history ($0).
              </p>
            )}

            <div>
              <label htmlFor="import-text" className={label}>Pasted text</label>
              <textarea id="import-text" rows={10} className={`${input} font-mono text-xs`} value={text} onChange={e => setText(e.target.value)}
                placeholder="Paste here…" />
            </div>
            {readError && <p className="text-sm text-red-500">{readError}</p>}
            <p className="text-xs text-gray-400">Nothing is saved until you review the list and tap Import.</p>
            <button onClick={() => review(text)} disabled={!text.trim() || reading !== null} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">
              {reading === "text" ? "Reading… (can take up to a minute for a long list)" : "Review"}
            </button>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />or upload screenshots<span className="h-px flex-1 bg-gray-200" />
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleScreenshots(e.target.files)} />
            <button onClick={() => fileInput.current?.click()} disabled={reading !== null}
              className="w-full bg-white text-indigo-700 border border-indigo-200 py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
              {reading === "screenshots" ? "Reading screenshots… (about 10–60 seconds)" : "📷 Upload screenshots"}
            </button>
            <p className="text-xs text-gray-400">
              Up to 8 at a time. Overlapping screenshots are fine — repeats are merged. Screenshots are read by Claude (AI) and not stored.
            </p>
          </>
        )}

        {step === "review" && (
          <>
            {(readAs || readNote) && (
              <p className="text-xs text-gray-400">{readAs && `Read as: ${readAs}.`} {readNote}</p>
            )}
            {rows.length === 0 ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-gray-700">
                No assignments found in that. Make sure you copied the page that lists each assignment with its score.
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Found {rows.length} item{rows.length === 1 ? "" : "s"}. Ticked rows will be saved; set the type for anything that's a quiz or test.
              </p>
            )}

            {rowError && <p className="text-sm text-red-500">{rowError}</p>}

            {rows.length > 0 && (
              <div className="rounded-2xl border border-gray-100 px-4 py-3 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Classes in this list</p>
                  <p className="text-xs text-gray-400">
                    Tap a class to choose: <span className="font-medium">Pays</span>, <span className="font-medium">Track only</span> (grades
                    and averages, $0), or <span className="font-medium">Leave out</span>. Saved for every later import.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ...classCounts(items),
                    ...classSettings.filter(e => !items.some(i => classKey(i.className) === e.classKey)).map(e => ({ className: e.className, count: 0 })),
                  ].map(c => {
                    const key = classKey(c.className);
                    const mode = classSettings.find(e => e.classKey === key)?.mode ?? "pays";
                    const word = mode === "track" ? "Track only" : mode === "leave_out" ? "Left out" : "Pays";
                    return (
                      <button key={key} onClick={() => setEditingClass(c.className)} disabled={saving}
                        aria-label={`${c.className}: ${word}. Change`}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border disabled:opacity-50 ${mode === "leave_out"
                          ? "bg-gray-100 text-gray-400 border-gray-200 line-through"
                          : mode === "track"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                        {c.className}{c.count ? ` (${c.count})` : ""}{mode === "track" ? " · Track only" : ""}
                      </button>
                    );
                  })}
                </div>
                {classSettings.some(e => e.mode === "track") && (
                  <p className="text-xs text-gray-400">Track only: {classSettings.filter(e => e.mode === "track").map(e => e.className).join(", ")}</p>
                )}
                {classSettings.some(e => e.mode === "leave_out") && (
                  <p className="text-xs text-gray-400">Left out: {classSettings.filter(e => e.mode === "leave_out").map(e => e.className).join(", ")}</p>
                )}
              </div>
            )}

            {cleanup && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{cleanup.items.length} {cleanup.className} item{cleanup.items.length === 1 ? " is" : "s are"} already in the app</span>
                  {" "}(worth {fmt(cleanup.items.reduce((s, a) => s + (a.recordedReward ?? 0), 0), { signed: true })} on the balance). Delete {cleanup.items.length === 1 ? "it" : "them"} too?
                </p>
                {cleanup.paidOut > 0 && (
                  <p className="text-xs text-gray-500">{cleanup.paidOut} more {cleanup.paidOut === 1 ? "was" : "were"} already paid out and stay{cleanup.paidOut === 1 ? "s" : ""} on record.</p>
                )}
                <div className="flex gap-2">
                  <button onClick={handleCleanup} disabled={cleaning}
                    className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-40">
                    {cleaning ? "Deleting…" : `Delete ${cleanup.items.length}`}
                  </button>
                  <button onClick={() => setCleanup(null)} disabled={cleaning}
                    className="flex-1 bg-white text-gray-600 py-2 rounded-xl text-sm border border-gray-200 disabled:opacity-40">
                    Keep them
                  </button>
                </div>
              </div>
            )}

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
      {editingClass && (
        <ClassSettingModal
          className={editingClass}
          current={classSettings.find(e => e.classKey === classKey(editingClass))?.mode ?? "pays"}
          assignments={appAssignments}
          studentName={studentName}
          onClose={() => setEditingClass(null)}
          onSaved={(next, changed) => handleClassSaved(editingClass, next, changed)}
        />
      )}
    </div>
  );
}
