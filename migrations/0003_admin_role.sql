-- Distinguishes one "admin" parent (can add parent accounts, reset other
-- parents' passwords) from other parent accounts in the same family.
-- Meaningless for role='student' rows, always 0 there.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

UPDATE users SET is_admin = 1 WHERE email = 'jsward01@gmail.com';
