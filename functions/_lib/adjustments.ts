/** Largest single adjustment, either direction — a typo guard (an extra zero), not a business rule. */
export const MAX_ADJUSTMENT = 10000;
export const MAX_REASON_LENGTH = 200;

export type AdjustmentInput = { amount: number; reason: string } | { error: string };

/** Check a parent's adjustment request. Amount is signed (+ adds to the balance, − takes away) and rounded to cents. */
export function validateAdjustment(body: unknown): AdjustmentInput {
  const b = (body ?? {}) as { amount?: unknown; reason?: unknown };
  const amount = typeof b.amount === "number" ? Math.round(b.amount * 100) / 100 : NaN;
  if (!Number.isFinite(amount) || amount === 0) return { error: "Amount must be a number other than 0" };
  if (Math.abs(amount) > MAX_ADJUSTMENT) return { error: `Amount can't be more than ${MAX_ADJUSTMENT} either way` };
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) return { error: "A reason is required" };
  if (reason.length > MAX_REASON_LENGTH) return { error: `Reason must be ${MAX_REASON_LENGTH} characters or fewer` };
  return { amount, reason };
}
