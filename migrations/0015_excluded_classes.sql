-- Classes a parent chose to leave out of grade imports entirely (e.g. an elective that isn't part of the deal), per
-- student. Matched by the normalized class name (src/lib/import/normalize.ts), the same key the import uses.
-- Excluding a class only affects imports; work already in the app is removed separately (bulk delete), by choice.
CREATE TABLE excluded_classes (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  class_key TEXT NOT NULL,
  -- As shown when it was excluded, for display.
  class_name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, class_key)
);
