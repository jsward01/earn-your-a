-- How the payout holdback is expressed: a fixed amount ('amount', the original behavior and the default) or a
-- percentage of the current balance ('percent'). The existing `holdback` column holds the number for either.
ALTER TABLE reward_settings ADD COLUMN holdback_type TEXT NOT NULL DEFAULT 'amount' CHECK (holdback_type IN ('amount', 'percent'));
