-- Real email alerts (sent by the scheduled Worker in workers/alerts).

-- Parent switch per student (Settings → Family): 0 = no alert emails go to this student, whatever they chose.
-- Default 1 = nothing changes until a parent turns it off. Meaningless for parents (always 1). Parents still get
-- their own alerts about the student either way.
ALTER TABLE users ADD COLUMN email_alerts_allowed INTEGER NOT NULL DEFAULT 1;

-- "Due today" goes out in the morning and "due tomorrow" in the evening, in the family's local time.
ALTER TABLE families ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Denver';

-- One row per email the Worker sends (or tried to). The primary key is the "already sent?" check: the Worker claims
-- the row before sending, so an email can't go out twice even if two runs overlap.
--   kind = 'morning' | 'evening' (ref = the family's local date) | 'payout_requested' | 'payout_resolved' (ref = payout id)
--   status = 'sending' (claimed) | 'sent' | 'failed' (permanent error, not retried; detail says why)
CREATE TABLE email_log (
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending',
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref)
);
