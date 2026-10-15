export async function recordHistory(
  db: D1Database,
  entry: {
    familyId: string;
    assignmentId: string;
    studentId: string;
    actorId: string;
    action: "create" | "update" | "delete";
    summary: string;
    ledgerBefore: number | null;
    ledgerAfter: number | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO assignment_history (id, family_id, assignment_id, student_id, actor_id, action, summary, ledger_before, ledger_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), entry.familyId, entry.assignmentId, entry.studentId, entry.actorId, entry.action, entry.summary, entry.ledgerBefore, entry.ledgerAfter)
    .run();
}

/** Sum of the ledger rows tied to one assignment, or null if it has none. */
export async function getRecordedReward(db: D1Database, assignmentId: string): Promise<number | null> {
  const row = await db
    .prepare("SELECT SUM(amount) AS total FROM reward_transactions WHERE assignment_id = ?")
    .bind(assignmentId)
    .first<{ total: number | null }>();
  return row?.total ?? null;
}

/**
 * Delete one assignment and its ledger row, and record the delete in its history. Callers check access first
 * (family, role, not paid out).
 */
export async function deleteAssignmentWithHistory(
  db: D1Database,
  existing: { id: string; student_id: string; title: string; type: string; status: string; grade: number | null },
  familyId: string,
  actorId: string,
): Promise<void> {
  const ledgerBefore = await getRecordedReward(db, existing.id);
  await db.prepare("DELETE FROM reward_transactions WHERE assignment_id = ?").bind(existing.id).run();
  await db.prepare("DELETE FROM assignments WHERE id = ?").bind(existing.id).run();

  const graded = existing.grade !== null ? `, ${existing.grade}%` : "";
  await recordHistory(db, {
    familyId,
    assignmentId: existing.id,
    studentId: existing.student_id,
    actorId,
    action: "delete",
    summary: `Deleted "${existing.title}" (${existing.type}, ${existing.status}${graded})`,
    ledgerBefore,
    ledgerAfter: null,
  });
}
