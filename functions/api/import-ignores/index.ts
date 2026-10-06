import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { normalize } from "../../../src/lib/import/normalize";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface IgnoreRow {
  id: string;
  class_key: string;
  title_key: string;
  class_name: string;
  title: string;
  created_at: string;
  created_by_name: string | null;
}

function toJson(r: IgnoreRow) {
  return { id: r.id, classKey: r.class_key, titleKey: r.title_key, className: r.class_name, title: r.title, createdAt: r.created_at, createdByName: r.created_by_name };
}

const SELECT = `SELECT i.id, i.class_key, i.title_key, i.class_name, i.title, i.created_at, u.name AS created_by_name
                FROM import_ignores i LEFT JOIN users u ON u.id = i.created_by`;

/** Parent-only: the import items this student's parents chose to ignore. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage imports" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const { results } = await context.env.DB
    .prepare(`${SELECT} WHERE i.family_id = ? AND i.student_id = ? ORDER BY i.created_at DESC`)
    .bind(user.familyId, resolved.studentId)
    .all<IgnoreRow>();
  return json(results.map(toJson), 200);
};

/** Parent-only: ignore an item (by class + title) on future imports. Ignoring the same thing twice is a no-op. */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage imports" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  let body: { className?: unknown; title?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const className = typeof body.className === "string" ? body.className.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!className || !title || className.length > 200 || title.length > 300) return json({ error: "className and title are required" }, 400);

  const classKey = normalize(className), titleKey = normalize(title);
  await context.env.DB
    .prepare(
      `INSERT INTO import_ignores (id, family_id, student_id, class_key, title_key, class_name, title, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (student_id, class_key, title_key) DO NOTHING`,
    )
    .bind(crypto.randomUUID(), user.familyId, resolved.studentId, classKey, titleKey, className, title, user.id)
    .run();
  const row = await context.env.DB
    .prepare(`${SELECT} WHERE i.student_id = ? AND i.class_key = ? AND i.title_key = ?`)
    .bind(resolved.studentId, classKey, titleKey)
    .first<IgnoreRow>();
  return json(toJson(row!), 201);
};
