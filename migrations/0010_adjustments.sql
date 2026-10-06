-- Manual adjustments: a parent-entered +/- ledger row with a reason, the safety valve for mistakes found after
-- work has been paid out and locked. Automatic rows (assignment rewards, payout deductions) leave all three NULL.
-- kind = 'adjustment' marks a manual entry; created_by is the parent who entered it; payout_id is the payout that
-- settled it (stamped on approval, like assignments.payout_id), after which it is locked.
ALTER TABLE reward_transactions ADD COLUMN kind TEXT;
ALTER TABLE reward_transactions ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE reward_transactions ADD COLUMN payout_id TEXT REFERENCES payout_requests(id);
CREATE INDEX idx_reward_tx_kind ON reward_transactions(student_id, kind);
