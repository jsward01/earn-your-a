import type { SessionUser } from "./session";

export type StudentResolution = { studentId: string } | { error: string; status: number };

/**
 * Decide which student a request is about.
 *
 * - A student session is always scoped to itself. Asking for a different
 *   student id is rejected rather than silently ignored.
 * - A parent may pass `?studentId=`; it must be a student in the parent's own
 *   family (checked here, so callers never trust the raw query value). With no
 *   `studentId`, the family's oldest student is used, which keeps single-child
 *   families working with no client changes.
 */
export async function resolveStudentId(db: D1Database, user: SessionUser, request: Request): Promise<StudentResolution> {
  const requested = new URL(request.url).searchParams.get("studentId");

  if (user.role === "student") {
    if (requested && requested !== user.id) return { error: "Forbidden", status: 403 };
    return { studentId: user.id };
  }

  if (requested) {
    const row = await db
      .prepare("SELECT id FROM users WHERE id = ? AND family_id = ? AND role = 'student'")
      .bind(requested, user.familyId)
      .first<{ id: string }>();
    if (!row) return { error: "Student not found", status: 404 };
    return { studentId: row.id };
  }

  const first = await db
    .prepare("SELECT id FROM users WHERE family_id = ? AND role = 'student' ORDER BY created_at, id LIMIT 1")
    .bind(user.familyId)
    .first<{ id: string }>();
  if (!first) return { error: "No student found for this family", status: 400 };
  return { studentId: first.id };
}
