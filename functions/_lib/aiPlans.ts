export interface AiPlanRow {
  id: string;
  family_id: string;
  student_id: string;
  title: string;
  subject: string;
  type: string;
  due_date: string;
  details: string;
  plan: string;
  checked: string;
  created_at: string;
}

export function toPlanJson(row: AiPlanRow) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    type: row.type,
    dueDate: row.due_date,
    details: row.details,
    plan: JSON.parse(row.plan),
    checked: JSON.parse(row.checked) as number[],
    createdAt: row.created_at,
  };
}

/** A plan the signed-in student owns, or null (other students' and other families' plans look missing). */
export async function getOwnPlan(db: D1Database, id: string, studentId: string): Promise<AiPlanRow | null> {
  return db.prepare("SELECT * FROM ai_plans WHERE id = ? AND student_id = ?").bind(id, studentId).first<AiPlanRow>();
}

/** Step indexes to keep: whole numbers inside the plan, each once, in order. null if `value` isn't a list of them. */
export function cleanChecked(value: unknown, stepCount: number): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(i => Number.isInteger(i) && i >= 0 && i < stepCount)) return null;
  return [...new Set(value as number[])].sort((a, b) => a - b);
}
