-- Whether missing work costs the same as a failing grade for its type (assignment / quiz / test penalty).
-- 0 = off, the original house rule: missing work earns nothing but costs nothing.
ALTER TABLE reward_settings ADD COLUMN missing_penalty INTEGER NOT NULL DEFAULT 0;
