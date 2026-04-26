-- Add physical stats columns to fighters table.
-- Data comes from UFCStats via ufcscraper (fighter_height_cm, fighter_reach_cm, fighter_stance).
-- All nullable — UFCStats often leaves these blank for older/inactive fighters.

ALTER TABLE fighters ADD COLUMN IF NOT EXISTS height_cm NUMERIC;
ALTER TABLE fighters ADD COLUMN IF NOT EXISTS reach_cm  NUMERIC;
ALTER TABLE fighters ADD COLUMN IF NOT EXISTS stance    TEXT;
