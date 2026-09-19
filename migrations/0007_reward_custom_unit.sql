-- The word a family uses when reward_type = 'custom' (e.g. "stars", "tokens"). Empty = show "units".
ALTER TABLE reward_settings ADD COLUMN custom_unit TEXT NOT NULL DEFAULT '';
