-- Audit trail for assignments: who changed what, when, and what it did to the ledger.
-- assignment_id deliberately has no foreign key: history must outlive a deleted assignment
-- (a delete is exactly the kind of change a parent wants a record of).
CREATE TABLE assignment_history (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  summary TEXT NOT NULL,
  ledger_before REAL,
  ledger_after REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assignment_history_assignment ON assignment_history(assignment_id);
CREATE INDEX idx_assignment_history_student ON assignment_history(student_id, created_at);
