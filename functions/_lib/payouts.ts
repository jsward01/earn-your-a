import { ARCHIVE_ON_PAYOUT_WHERE } from "./assignments";

/**
 * The writes that pay out a pending payout: ledger deduction, archive/lock of the paid work and of manual adjustments,
 * then the status flip. Meant for one `db.batch` (D1 runs a batch as a single transaction). Every write is guarded by
 * "the request is still pending" and the status flip comes LAST, so a double-tap, or two parents approving at once,
 * can never deduct twice: the second batch finds nothing to do. Check the last result's `changes === 1` to know it paid.
 */
export function payOutStatements(db: D1Database, payoutId: string, studentId: string, parentId: string): D1PreparedStatement[] {
  const stillPending = "EXISTS (SELECT 1 FROM payout_requests p WHERE p.id = ? AND p.status = 'pending')";
  return [
    db
      .prepare(
        `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason)
         SELECT ?, family_id, student_id, NULL, -amount, 'Payout approved' FROM payout_requests WHERE id = ? AND status = 'pending'`,
      )
      .bind(crypto.randomUUID(), payoutId),
    // Paying out settles the period: archive (and so lock) the finished work that was paid for.
    db
      .prepare(`UPDATE assignments SET payout_id = ? WHERE student_id = ? AND ${ARCHIVE_ON_PAYOUT_WHERE} AND ${stillPending}`)
      .bind(payoutId, studentId, payoutId),
    // Manual adjustments settle the same way: they move to that payout's Past Grades and can no longer be reversed there.
    db
      .prepare(`UPDATE reward_transactions SET payout_id = ? WHERE student_id = ? AND kind = 'adjustment' AND payout_id IS NULL AND ${stillPending}`)
      .bind(payoutId, studentId, payoutId),
    db
      .prepare("UPDATE payout_requests SET status = 'paid', resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND status = 'pending'")
      .bind(parentId, payoutId),
  ];
}
