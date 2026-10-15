import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { normalize, stripTerm } from "../../../src/lib/import/normalize";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface ExcludedRow {
  id: string;
  class_key: string;
  class_name: string;
  created_at: string;
  created_by_name: string | null;
}

function toJson(r: ExcludedRow) {
  return { id: r.id, classKey: r.class_key, className: r.class_name, createdAt: r.created_at, createdByName: r.created_by_name };
}

const SELECT = `SELECT e.id, e.class_key, e.class_name, e.created_at, u.name AS created_by_name
                FROM excluded_classes e LEFT JOIN users u ON u.id = e.created_by`;

/** Parent-only: the classes this student's parents left out of grade imports. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage imports" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const { results } = await context.env.DB
    .prepare(`${SELECT} WHERE e.family_id = ? AND e.student_id = ? ORDER BY e.class_name`)
    .bind(user.familyId, resolved.studentId)
    .all<ExcludedRow>();
  return json(results.map(toJson), 200);
};

/** Parent-only: leave a whole class out of future imports. Excluding the same class twice is a no-op. */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage imports" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  let body: { className?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const className = typeof body.className === "string" ? stripTerm(body.className.trim()) : "";
  const classKey = normalize(className);
  if (!classKey || className.length > 200) return json({ error: "className is required" }, 400);

  await context.env.DB
    .prepare(
      `INSERT INTO excluded_classes (id, family_id, student_id, class_key, class_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (student_id, class_key) DO NOTHING`,
    )
    .bind(crypto.randomUUID(), user.familyId, resolved.studentId, classKey, className, user.id)
    .run();
  const row = await context.env.DB
    .prepare(`${SELECT} WHERE e.student_id = ? AND e.class_key = ?`)
    .bind(resolved.studentId, classKey)
    .first<ExcludedRow>();
  return json(toJson(row!), 201);
};
