-- Each person's accent color for their own app (Profile / My Account → Color). NULL = the role's default (students
-- indigo, parents emerald). Allowed values live in functions/_lib/accent.ts and src/lib/accent.ts.
ALTER TABLE users ADD COLUMN accent TEXT;
