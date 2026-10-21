import { localClock } from "./emailAlerts";

/**
 * Per-family daily limits on the features that call Claude with the app's own API key. A safety net against a bug
 * or abuse running up the bill, not a cost control: normal use is a few a day (decided with Jonathan, Oct 21 2026).
 */
export const AI_DAILY_LIMITS = {
  extract: 20, // grade import "read by AI" (screenshots, non-Campus pastes)
  plan: 20, // AI Planner
} as const;

export type AiFeature = keyof typeof AI_DAILY_LIMITS;

export type AiClaim = { ok: true; release: () => Promise<void> } | { ok: false; limit: number };

/** The family-local calendar day a use counts toward. */
export async function aiUsageDay(db: D1Database, familyId: string, now: Date = new Date()): Promise<string> {
  const row = await db.prepare("SELECT timezone FROM families WHERE id = ?").bind(familyId).first<{ timezone: string | null }>();
  return localClock(now, row?.timezone || "America/Denver").date;
}

/**
 * Claim one use before calling Claude. Atomic: the upsert only bumps the count while it is under the limit, so two
 * requests racing for the last use can't both get it. Call `release()` if the call then fails, so a failure doesn't
 * count against the family.
 */
export async function claimAiUse(db: D1Database, familyId: string, feature: AiFeature, now: Date = new Date()): Promise<AiClaim> {
  const limit = AI_DAILY_LIMITS[feature];
  const day = await aiUsageDay(db, familyId, now);
  const row = await db
    .prepare(
      `INSERT INTO ai_usage (family_id, day, feature, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (family_id, day, feature) DO UPDATE SET count = count + 1 WHERE count < ?
       RETURNING count`,
    )
    .bind(familyId, day, feature, limit)
    .first<{ count: number }>();
  if (!row) return { ok: false, limit };
  return {
    ok: true,
    release: async () => {
      await db
        .prepare("UPDATE ai_usage SET count = count - 1 WHERE family_id = ? AND day = ? AND feature = ? AND count > 0")
        .bind(familyId, day, feature)
        .run();
    },
  };
}

/** The 429 text shown when a family is out of uses for today. */
export function aiLimitMessage(feature: AiFeature, limit: number): string {
  const what = feature === "extract" ? "AI reads of grades" : "AI plans";
  return `Your family has used today's ${limit} ${what}. It resets at midnight.`;
}
