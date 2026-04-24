-- Migration 001: ufcstats source IDs + division-specific ELO schema
-- Run once in the Supabase SQL editor on an existing schema.sql database.

-- Idempotent upsert support
ALTER TABLE fighters ADD COLUMN IF NOT EXISTS ufcstats_id TEXT UNIQUE;
ALTER TABLE events   ADD COLUMN IF NOT EXISTS ufcstats_id TEXT UNIQUE;
ALTER TABLE fights   ADD COLUMN IF NOT EXISTS ufcstats_id TEXT UNIQUE;

-- ELO is division-specific: weight_class moves from fighters to elo_history
ALTER TABLE fighters    DROP COLUMN IF EXISTS weight_class;
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS weight_class TEXT NOT NULL DEFAULT 'unknown';

-- Updated indexes
DROP INDEX IF EXISTS fighters_weight_class_idx;
CREATE INDEX IF NOT EXISTS elo_history_fighter_wc_date_idx ON elo_history (fighter_id, weight_class, date);
CREATE INDEX IF NOT EXISTS elo_history_wc_date_idx         ON elo_history (weight_class, date);
