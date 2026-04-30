-- Gendered P4P views for the rankings page ELO column.
-- Gender is derived from weight class history: any fighter who has competed
-- in a Women's division is classified as women; all others as men.
-- The base current_p4p / active_p4p views are unchanged (leaderboard uses them).

CREATE VIEW current_p4p_womens WITH (security_invoker = on) AS
SELECT * FROM current_p4p
WHERE fighter_id IN (
  SELECT DISTINCT fighter_id FROM elo_history
  WHERE weight_class LIKE 'Women%'
);

CREATE VIEW active_p4p_womens WITH (security_invoker = on) AS
SELECT * FROM active_p4p
WHERE fighter_id IN (
  SELECT DISTINCT fighter_id FROM elo_history
  WHERE weight_class LIKE 'Women%'
);

CREATE VIEW current_p4p_mens WITH (security_invoker = on) AS
SELECT * FROM current_p4p
WHERE fighter_id NOT IN (
  SELECT DISTINCT fighter_id FROM elo_history
  WHERE weight_class LIKE 'Women%'
);

CREATE VIEW active_p4p_mens WITH (security_invoker = on) AS
SELECT * FROM active_p4p
WHERE fighter_id NOT IN (
  SELECT DISTINCT fighter_id FROM elo_history
  WHERE weight_class LIKE 'Women%'
);

GRANT SELECT ON current_p4p_womens TO anon, authenticated;
GRANT SELECT ON active_p4p_womens  TO anon, authenticated;
GRANT SELECT ON current_p4p_mens   TO anon, authenticated;
GRANT SELECT ON active_p4p_mens    TO anon, authenticated;
