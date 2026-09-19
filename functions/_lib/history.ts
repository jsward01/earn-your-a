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
