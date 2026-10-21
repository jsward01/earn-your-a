-- Three settings per class instead of "left out or not": Pays (no row), Track only ('track': imported and graded,
-- counts in averages, never earns or costs anything), Leave out ('leave_out': skipped by imports, as before).
-- Existing rows were all "left out", so they keep that.
ALTER TABLE excluded_classes ADD COLUMN mode TEXT NOT NULL DEFAULT 'leave_out';

-- 1 = in a Track only class: recorded, priced at $0, no retake window, never archived by a payout (like history_only).
-- Set from the class setting when work is added or moved to another class, and when a parent changes the setting and
-- chooses to apply it to the class's unpaid work.
ALTER TABLE assignments ADD COLUMN track_only INTEGER NOT NULL DEFAULT 0;

-- Parent switch per student: show Track only work in the Overview's To Grade / Missing / Low Grade lists (1 = show).
ALTER TABLE users ADD COLUMN track_only_alerts INTEGER NOT NULL DEFAULT 1;
