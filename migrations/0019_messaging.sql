-- Real messaging (Oct 21, 2026). Decisions with Jonathan: one family chat per student (the student and all of the
-- family's parents), an unread badge plus an email alert, a parent switch per student (on by default), no deleting.

-- The conversation a message belongs to: the student it's with. (0001 had family_id only; the table was never used,
-- 0 rows on remote when this was written.)
ALTER TABLE messages ADD COLUMN student_id TEXT REFERENCES users(id);
CREATE INDEX idx_messages_student ON messages(student_id, created_at);

-- Parent switch per student (Settings → Family): 0 = messaging off for this student (the student loses the
-- Messages tab; nobody can post to that conversation). Meaningless for parents.
ALTER TABLE users ADD COLUMN messaging_allowed INTEGER NOT NULL DEFAULT 1;

-- Each person's own "New messages" email choice (Alerts → ⚙️ Settings); only applies while their email alerts are on.
ALTER TABLE notification_settings ADD COLUMN messages INTEGER NOT NULL DEFAULT 1;

-- Per person per conversation: the last message they've seen (unread badge) and the last one they were emailed
-- about (so each email only covers what's new). Both are messages.rowid values.
CREATE TABLE message_reads (
  user_id TEXT NOT NULL REFERENCES users(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  read_rowid INTEGER NOT NULL DEFAULT 0,
  emailed_rowid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, student_id)
);
