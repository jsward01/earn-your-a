-- AI Planner plans, saved so they survive a refresh and show on any device. Private to the student who made them
-- (Jonathan, Oct 21 2026: parents don't see them). Steps are stored as the AI returned them; `checked` is which ones
-- the student has ticked off.
CREATE TABLE ai_plans (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  due_date TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  -- JSON: { summary, estimatedHours, steps: [{ day, task, duration, tip? }] }
  plan TEXT NOT NULL,
  -- JSON array of step indexes the student has checked off.
  checked TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ai_plans_student ON ai_plans (student_id, created_at);
