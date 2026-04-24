-- ============================================================
-- UFC ELO — Supabase Schema
-- Paste this entire file into the Supabase SQL editor and run it.
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

CREATE TABLE fighters (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT    NOT NULL,
  weight_class   TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'active',
  nationality    TEXT,
  date_of_birth  DATE
);

CREATE TABLE events (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  date      DATE NOT NULL,
  location  TEXT
);

CREATE TABLE fights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID    NOT NULL REFERENCES events(id),
  fighter_a_id   UUID    NOT NULL REFERENCES fighters(id),
  fighter_b_id   UUID    NOT NULL REFERENCES fighters(id),
  winner_id      UUID             REFERENCES fighters(id),  -- NULL = draw / no contest
  method         TEXT,
  round          INTEGER,
  time           TEXT,
  weight_class   TEXT    NOT NULL,
  is_title_fight BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE elo_history (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id  UUID    NOT NULL REFERENCES fighters(id),
  fight_id    UUID    NOT NULL REFERENCES fights(id),
  elo_before  NUMERIC NOT NULL,
  elo_after   NUMERIC NOT NULL,
  delta       NUMERIC NOT NULL,  -- stored explicitly for upset queries
  date        DATE    NOT NULL
);

CREATE TABLE rankings (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id   UUID    NOT NULL REFERENCES fighters(id),
  weight_class TEXT    NOT NULL,
  rank         INTEGER NOT NULL,  -- 0 = champion, 1-15 = ranked contenders
  valid_from   DATE    NOT NULL,
  valid_to     DATE                -- NULL = currently active
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX ON elo_history (fighter_id, date);
CREATE INDEX ON elo_history (fight_id);
CREATE INDEX ON elo_history (delta);
CREATE INDEX ON rankings (valid_to);
CREATE INDEX ON rankings (weight_class, valid_to);
CREATE INDEX ON fighters (weight_class);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

ALTER TABLE fighters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings    ENABLE ROW LEVEL SECURITY;

-- Public read (anon key). Writes are done by the Python pipeline
-- using the service role key, which bypasses RLS entirely.
CREATE POLICY "public_read" ON fighters    FOR SELECT USING (true);
CREATE POLICY "public_read" ON events      FOR SELECT USING (true);
CREATE POLICY "public_read" ON fights      FOR SELECT USING (true);
CREATE POLICY "public_read" ON elo_history FOR SELECT USING (true);
CREATE POLICY "public_read" ON rankings    FOR SELECT USING (true);
