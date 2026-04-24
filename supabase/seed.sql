-- ============================================================
-- UFC ELO — Seed Data
-- A handful of real fights to validate the schema.
-- Paste into the Supabase SQL editor and run.
--
-- Covers:
--   - Two weight classes (heavyweight, light heavyweight)
--   - Title fights
--   - A real draw (Blachowicz vs Ankalaev) — validates winner_id IS NULL
--   - ELO history with explicit deltas
--   - Current rankings snapshot (valid_to = NULL)
-- ============================================================

-- ------------------------------------------------------------
-- Fighters
-- ------------------------------------------------------------

INSERT INTO fighters (id, name, weight_class, status, nationality, date_of_birth) VALUES
  ('a100000000000000000000000000001a', 'Jon Jones',           'heavyweight',       'active',   'USA',    '1987-07-19'),
  ('a100000000000000000000000000002a', 'Ciryl Gane',          'heavyweight',       'active',   'France', '1990-05-26'),
  ('a100000000000000000000000000003a', 'Stipe Miocic',        'heavyweight',       'retired',  'USA',    '1982-08-19'),
  ('a100000000000000000000000000004a', 'Alex Pereira',        'light heavyweight', 'active',   'Brazil', '1987-07-08'),
  ('a100000000000000000000000000005a', 'Jamahal Hill',        'light heavyweight', 'active',   'USA',    '1991-07-01'),
  ('a100000000000000000000000000006a', 'Jiri Prochazka',      'light heavyweight', 'active',   'Czech Republic', '1993-10-14'),
  ('a100000000000000000000000000007a', 'Jan Blachowicz',      'light heavyweight', 'active',   'Poland', '1983-02-24'),
  ('a100000000000000000000000000008a', 'Magomed Ankalaev',    'light heavyweight', 'active',   'Russia', '1992-06-02');

-- ------------------------------------------------------------
-- Events
-- ------------------------------------------------------------

INSERT INTO events (id, name, date, location) VALUES
  ('b100000000000000000000000000001b', 'UFC 282',  '2022-12-10', 'Las Vegas, Nevada, USA'),
  ('b100000000000000000000000000002b', 'UFC 285',  '2023-03-04', 'Las Vegas, Nevada, USA'),
  ('b100000000000000000000000000003b', 'UFC 300',  '2024-04-13', 'Las Vegas, Nevada, USA');

-- ------------------------------------------------------------
-- Fights
-- ------------------------------------------------------------

INSERT INTO fights (id, event_id, fighter_a_id, fighter_b_id, winner_id, method, round, time, weight_class, is_title_fight) VALUES
  -- UFC 282: Blachowicz vs Ankalaev — DRAW (validates winner_id IS NULL)
  (
    'c100000000000000000000000000001c',
    'b100000000000000000000000000001b',
    'a100000000000000000000000000007a',  -- Blachowicz
    'a100000000000000000000000000008a',  -- Ankalaev
    NULL,                                -- draw
    'Decision (split)',
    5, '5:00',
    'light heavyweight',
    TRUE
  ),
  -- UFC 285: Jones vs Gane — Jones wins (HW title)
  (
    'c100000000000000000000000000002c',
    'b100000000000000000000000000002b',
    'a100000000000000000000000000001a',  -- Jones
    'a100000000000000000000000000002a',  -- Gane
    'a100000000000000000000000000001a',  -- Jones wins
    'Submission (guillotine choke)',
    1, '2:04',
    'heavyweight',
    TRUE
  ),
  -- UFC 300: Pereira vs Hill — Pereira wins (LHW title)
  (
    'c100000000000000000000000000003c',
    'b100000000000000000000000000003b',
    'a100000000000000000000000000004a',  -- Pereira
    'a100000000000000000000000000005a',  -- Hill
    'a100000000000000000000000000004a',  -- Pereira wins
    'KO (punches)',
    1, '1:27',
    'light heavyweight',
    TRUE
  );

-- ------------------------------------------------------------
-- ELO History
-- Seed ELOs are illustrative starting points.
-- The Python pipeline will overwrite these with real calculations
-- when back-fill runs. These rows exist only to validate the schema.
-- ------------------------------------------------------------

INSERT INTO elo_history (id, fighter_id, fight_id, elo_before, elo_after, delta, date) VALUES
  -- UFC 282: Blachowicz vs Ankalaev (draw — tiny ELO shift toward Ankalaev)
  ('d100000000000000000000000000001d', 'a100000000000000000000000000007a', 'c100000000000000000000000000001c', 1650, 1644, -6,  '2022-12-10'),
  ('d100000000000000000000000000002d', 'a100000000000000000000000000008a', 'c100000000000000000000000000001c', 1520, 1526,  6,  '2022-12-10'),
  -- UFC 285: Jones vs Gane
  ('d100000000000000000000000000003d', 'a100000000000000000000000000001a', 'c100000000000000000000000000002c', 1800, 1811, 11,  '2023-03-04'),
  ('d100000000000000000000000000004d', 'a100000000000000000000000000002a', 'c100000000000000000000000000002c', 1680, 1669, -11, '2023-03-04'),
  -- UFC 300: Pereira vs Hill
  ('d100000000000000000000000000005d', 'a100000000000000000000000000004a', 'c100000000000000000000000000003c', 1750, 1760, 10,  '2024-04-13'),
  ('d100000000000000000000000000006d', 'a100000000000000000000000000005a', 'c100000000000000000000000000003c', 1620, 1610, -10, '2024-04-13');

-- ------------------------------------------------------------
-- Rankings (current snapshot — valid_to = NULL means active)
-- ------------------------------------------------------------

INSERT INTO rankings (id, fighter_id, weight_class, rank, valid_from, valid_to) VALUES
  -- Heavyweight
  ('e100000000000000000000000000001e', 'a100000000000000000000000000001a', 'heavyweight',       0, '2023-03-04', NULL),  -- Jones, champion
  ('e100000000000000000000000000002e', 'a100000000000000000000000000002a', 'heavyweight',       1, '2023-03-04', NULL),  -- Gane, #1
  ('e100000000000000000000000000003e', 'a100000000000000000000000000003a', 'heavyweight',       2, '2023-03-04', NULL),  -- Miocic, #2
  -- Light Heavyweight
  ('e100000000000000000000000000004e', 'a100000000000000000000000000004a', 'light heavyweight', 0, '2024-04-13', NULL),  -- Pereira, champion
  ('e100000000000000000000000000005e', 'a100000000000000000000000000006a', 'light heavyweight', 1, '2024-04-13', NULL),  -- Prochazka, #1
  ('e100000000000000000000000000006e', 'a100000000000000000000000000007a', 'light heavyweight', 2, '2024-04-13', NULL),  -- Blachowicz, #2
  ('e100000000000000000000000000007e', 'a100000000000000000000000000008a', 'light heavyweight', 3, '2024-04-13', NULL),  -- Ankalaev, #3
  ('e100000000000000000000000000008e', 'a100000000000000000000000000005a', 'light heavyweight', 4, '2024-04-13', NULL);  -- Hill, #4
