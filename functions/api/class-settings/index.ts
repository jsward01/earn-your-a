import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { getBalance, getFullRewardSettings } from "../../_lib/rewards";
import { stripTerm } from "../../../src/lib/import/normalize";
import { CLASS_MODES, classChangeStatements, classKeyOf, loadUnpaidWork, planClassChange, type ClassMode } from "../../_lib/classSettings";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface ClassRow {
  id: string;
  class_key: string;
  class_name: string;
  mode: string;
  created_at: string;
  created_by_name: string | null;
}

const SELECT = `SELECT e.id, e.class_key, e.class_name, e.mode, e.created_at, u.name AS created_by_name
                FROM excluded_classes e LEFT JOIN users u ON u.id = e.created_by`;

async function listClasses(db: D1Database, familyId: string, studentId: string) {
  const { results } = await db
    .prepare(`${SELECT} WHERE e.family_id = ? AND e.student_id = ? ORDER BY e.class_name`)
    .bind(familyId, studentId)
    .all<ClassRow>();
  return results.map(r => ({
    id: r.id, classKey: r.class_key, className: r.class_name, mode: (r.mode === "track" ? "track" : "leave_out") as ClassMode,
    createdAt: r.created_at, createdByName: r.created_by_name,
  }));
}

/**
 * Parent-only: this student's class settings. Only classes set to Track only or Leave out are listed (every other
 * class pays), plus the switch for showing Track only work in the Overview's to-do lists.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage classes" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const student = await context.env.DB
    .prepare("SELECT track_only_alerts FROM users WHERE id = ?")
    .bind(resolved.studentId)
    .first<{ track_only_alerts: number }>();
  return json({
    classes: await listClasses(context.env.DB, user.familyId, resolved.studentId),
    showTrackOnlyAlerts: student?.track_only_alerts !== 0,
  }, 200);
};

/**
 * Parent-only: set one class to Pays, Track only, or Leave out. Body `{className, mode, applyToExisting}`:
 * with `applyToExisting`, Pays / Track only also re-price the class's unpaid work already in the app (Track only →
 * $0; Pays → today's rates); without it only work added from now on follows. Paid-out work never changes, and Leave
 * out never touches existing work (the import offers to delete it). `?dryRun=1` returns the effect and writes nothing.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage classes" }, 403);
  const resolved = await resolveStudentId(db, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  let body: { className?: unknown; mode?: unknown; applyToExisting?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const className = typeof body.className === "string" ? stripTerm(body.className.trim()) : "";
  const classKey = classKeyOf(className);
  if (!classKey || className.length > 200) return json({ error: "className is required" }, 400);
  if (!CLASS_MODES.includes(body.mode as ClassMode)) return json({ error: "mode must be pays, track or leave_out" }, 400);
  const mode = body.mode as ClassMode;
  if (body.applyToExisting !== undefined && typeof body.applyToExisting !== "boolean") {
    return json({ error: "applyToExisting must be true or false" }, 400);
  }

  const settings = await getFullRewardSettings(db, user.familyId);
  const changes = body.applyToExisting && mode !== "leave_out"
    ? planClassChange(await loadUnpaidWork(db, studentId), classKey, mode === "track", settings)
    : [];
  const delta = Math.round(changes.reduce((sum, c) => sum + c.after - c.before, 0) * 100) / 100;
  const balanceBefore = await getBalance(db, studentId);
  const affected = { count: changes.length, delta, balanceBefore, balanceAfter: Math.round((balanceBefore + delta) * 100) / 100 };

  if (new URL(context.request.url).searchParams.get("dryRun") === "1") return json({ affected }, 200);

  const statements: D1PreparedStatement[] = [
    mode === "pays"
      ? db.prepare("DELETE FROM excluded_classes WHERE student_id = ? AND class_key = ?").bind(studentId, classKey)
      : db
        .prepare(
          `INSERT INTO excluded_classes (id, family_id, student_id, class_key, class_name, mode, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (student_id, class_key) DO UPDATE SET mode = excluded.mode, class_name = excluded.class_name,
             created_by = excluded.created_by, created_at = datetime('now')`,
        )
        .bind(crypto.randomUUID(), user.familyId, studentId, classKey, className, mode, user.id),
    ...classChangeStatements(db, changes, mode === "track", { familyId: user.familyId, studentId, actorId: user.id, className }),
  ];
  await db.batch(statements);

  return json({ classes: await listClasses(db, user.familyId, studentId), affected }, 200);
};
