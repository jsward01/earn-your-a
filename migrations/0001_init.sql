-- Core schema for Earn Your A.
-- family_id is on every table from day one so multi-family support later
-- (the stated long-term goal) doesn't require a data model migration --
-- just an isolation check in every query.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_family ON users(family_id);

-- One row per family. Mirrors the ParentSettings screen.
CREATE TABLE reward_settings (
  family_id TEXT PRIMARY KEY REFERENCES families(id),
  assignment_reward REAL NOT NULL DEFAULT 3,
  test_reward REAL NOT NULL DEFAULT 20,
  passing_threshold REAL NOT NULL DEFAULT 70,
  makeup_window_days INTEGER NOT NULL DEFAULT 7,
  holdback REAL NOT NULL DEFAULT 20,
  reward_type TEXT NOT NULL DEFAULT 'money' CHECK (reward_type IN ('money', 'screen', 'points', 'custom')),
  excellence_bonus INTEGER NOT NULL DEFAULT 1,
  streak_bonus INTEGER NOT NULL DEFAULT 1,
  payout_schedule TEXT NOT NULL DEFAULT 'request' CHECK (payout_schedule IN ('request', 'monthly', 'manual')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'quiz', 'test')),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'graded', 'missing')) DEFAULT 'pending',
  grade REAL,
  -- Set when a grade/status makes the assignment makeup-eligible
  -- (failing test/quiz, or missing work); NULL once the window closes or isn't applicable.
  makeup_deadline TEXT,
  makeup_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assignments_student ON assignments(student_id);
CREATE INDEX idx_assignments_family ON assignments(family_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);

-- Append-only ledger. A student's balance is SUM(amount) over their rows.
-- Replaces the mocked WEEKLY_HISTORY/balance arithmetic in the prototype.
CREATE TABLE reward_transactions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  assignment_id TEXT REFERENCES assignments(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reward_tx_student ON reward_transactions(student_id);

CREATE TABLE payout_requests (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  holdback_amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'delayed', 'denied', 'paid')) DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

CREATE INDEX idx_payout_requests_student ON payout_requests(student_id);

CREATE TABLE savings_goals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_family ON messages(family_id);

CREATE TABLE notification_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  sms INTEGER NOT NULL DEFAULT 1,
  email INTEGER NOT NULL DEFAULT 1,
  in_app INTEGER NOT NULL DEFAULT 1,
  due_3days INTEGER NOT NULL DEFAULT 1,
  due_1day INTEGER NOT NULL DEFAULT 1,
  due_today INTEGER NOT NULL DEFAULT 1,
  makeup INTEGER NOT NULL DEFAULT 1,
  payout INTEGER NOT NULL DEFAULT 1,
  grade INTEGER NOT NULL DEFAULT 1,
  weekly INTEGER NOT NULL DEFAULT 1,
  phone TEXT,
  email_addr TEXT,
  quiet_start TEXT,
  quiet_end TEXT
);
