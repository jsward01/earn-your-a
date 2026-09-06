export interface AssignmentRow {
  id: string;
  family_id: string;
  student_id: string;
  title: string;
  subject: string;
  type: "assignment" | "quiz" | "test";
  due_date: string;
  status: "pending" | "graded" | "missing";
  grade: number | null;
  makeup_deadline: string | null;
  makeup_used: number;
}

interface RewardSettingsRow {
  passing_threshold: number;
  makeup_window_days: number;
}

export async function getRewardSettings(
  db: D1Database,
  familyId: string,
): Promise<{ passingThreshold: number; makeupWindowDays: number }> {
  const row = await db
    .prepare("SELECT passing_threshold, makeup_window_days FROM reward_settings WHERE family_id = ?")
    .bind(familyId)
    .first<RewardSettingsRow>();
  return {
    passingThreshold: row?.passing_threshold ?? 70,
    makeupWindowDays: row?.makeup_window_days ?? 7,
  };
}

export async function getStudentId(db: D1Database, familyId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM users WHERE family_id = ? AND role = 'student' LIMIT 1")
    .bind(familyId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

/**
 * House rule: a missing or low (<passingThreshold) assignment/test/quiz gets a
 * fixed makeup window from the moment it first enters that state. Editing the
 * grade/status while already inside a window does not reset its deadline —
 * once the window closes the penalty is meant to lock in permanently.
 */
export function nextMakeupState(
  current: { deadline: string | null },
  status: string,
  grade: number | null,
  passingThreshold: number,
  makeupWindowDays: number,
  now: Date,
): { deadline: string | null; used: number } {
  const needsMakeup = status === "missing" || (status === "graded" && grade !== null && grade < passingThreshold);

  if (!needsMakeup) {
    return { deadline: null, used: current.deadline ? 1 : 0 };
  }
  if (current.deadline) {
    return { deadline: current.deadline, used: 0 };
  }
  const d = new Date(now);
  d.setDate(d.getDate() + makeupWindowDays);
  return { deadline: d.toISOString().slice(0, 10), used: 0 };
}

export function toAssignmentJson(row: AssignmentRow) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    type: row.type,
    dueDate: row.due_date,
    status: row.status,
    grade: row.grade,
    makeupDeadline: row.makeup_deadline,
    makeupUsed: row.makeup_used === 1,
  };
}
