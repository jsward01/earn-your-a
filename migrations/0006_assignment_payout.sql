-- Marks an assignment as settled by a payout. NULL = still "current" (editable by a parent).
-- Set when a parent approves a payout; settled work is archived under "Past Grades" and locked.
ALTER TABLE assignments ADD COLUMN payout_id TEXT REFERENCES payout_requests(id);
CREATE INDEX idx_assignments_payout ON assignments(payout_id);
