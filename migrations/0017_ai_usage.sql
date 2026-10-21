-- How many times each family used a Claude-backed feature on a given (family-local) day, so one family can't run up
-- the app's Anthropic bill (every family shares one ANTHROPIC_API_KEY). Limits live in functions/_lib/aiUsage.ts.
-- A use is claimed before the call and handed back if the call fails, so `count` = successful uses + calls in flight.
CREATE TABLE ai_usage (
  family_id TEXT NOT NULL REFERENCES families(id),
  -- YYYY-MM-DD in families.timezone, so the count resets at the family's midnight.
  day TEXT NOT NULL,
  -- 'extract' (grade import read by AI) or 'plan' (AI Planner).
  feature TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, day, feature)
);
