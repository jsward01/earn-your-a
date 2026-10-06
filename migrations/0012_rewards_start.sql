-- When rewards start for each student. Work due before this date is "history": it's recorded (grades, averages)
-- but never earns or costs anything. Asked once, on the first grade import; changeable in Settings.
ALTER TABLE users ADD COLUMN rewards_start_date TEXT;

-- Set once when an assignment is created (due date before the student's start date) and never re-derived, so moving
-- the start date later can't silently re-price work that was already counted. History work has no ledger entry,
-- no makeup window, and is never swept into a payout.
ALTER TABLE assignments ADD COLUMN history_only INTEGER NOT NULL DEFAULT 0;

-- Students who already have work: rewards started with their earliest work, so nothing about them changes.
UPDATE users SET rewards_start_date = (SELECT MIN(a.due_date) FROM assignments a WHERE a.student_id = users.id)
WHERE role = 'student' AND EXISTS (SELECT 1 FROM assignments a WHERE a.student_id = users.id);
