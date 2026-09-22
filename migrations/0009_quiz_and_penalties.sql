-- Quizzes get their own reward (they used to share the test amount), and each kind of work gets its own penalty for
-- finishing below the pass mark. Defaults are the family's agreed rules: quiz $10, and the penalty for a failed test /
-- quiz equals what it would have paid ($20 / $10); a failed regular assignment carries no penalty ($0), as before.
-- Existing ledger rows are NOT re-priced; new grading uses these amounts.
ALTER TABLE reward_settings ADD COLUMN quiz_reward REAL NOT NULL DEFAULT 10;
ALTER TABLE reward_settings ADD COLUMN assignment_penalty REAL NOT NULL DEFAULT 0;
ALTER TABLE reward_settings ADD COLUMN quiz_penalty REAL NOT NULL DEFAULT 10;
ALTER TABLE reward_settings ADD COLUMN test_penalty REAL NOT NULL DEFAULT 20;
