-- Alerts page (Alert Center): which alerts each person has read or dismissed. The alerts themselves are worked out
-- in the browser from the assignments (src/lib/notifications.ts), each with a stable id such as "dueToday-<assignment
-- id>"; before this, read/dismissed lived only on screen and came back every visit (Jonathan, Oct 21 2026).
CREATE TABLE notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id),
  notification_id TEXT NOT NULL,
  -- 'read' or 'dismissed' (dismissed implies read).
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, notification_id)
);
