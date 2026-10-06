-- Grade-import items a parent chose to ignore ("never offer this one again"), per student. Matched by the same
-- normalized class + title keys the import uses (src/lib/import/normalize.ts), so case/punctuation changes still match.
CREATE TABLE import_ignores (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  class_key TEXT NOT NULL,
  title_key TEXT NOT NULL,
  -- As shown when it was ignored, for display.
  class_name TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, class_key, title_key)
);
