-- Career-spanning P4P ELO columns on elo_history.
-- Unlike divisional ELO, P4P never resets when a fighter changes weight class.
-- Populated by running recalculate.py after deploying this migration.

ALTER TABLE elo_history
  ADD COLUMN p4p_elo_before NUMERIC,
  ADD COLUMN p4p_elo_after  NUMERIC,
  ADD COLUMN p4p_delta      NUMERIC;

CREATE INDEX ON elo_history (fighter_id, date) WHERE p4p_elo_after IS NOT NULL;

-- current_p4p: most recent P4P ELO per fighter
CREATE VIEW current_p4p WITH (security_invoker = on) AS
SELECT DISTINCT ON (eh.fighter_id)
  eh.fighter_id,
  f.name       AS fighter_name,
  f.status     AS fighter_status,
  eh.p4p_elo_after AS elo,
  eh.date,
  eh.fight_id,
  eh.p4p_delta AS delta
FROM elo_history eh
JOIN fighters f ON f.id = eh.fighter_id
WHERE eh.p4p_elo_after IS NOT NULL
ORDER BY eh.fighter_id, eh.date DESC, eh.id DESC;

GRANT SELECT ON current_p4p TO anon, authenticated;

-- active_p4p: P4P leaderboard for fighters who have fought in the last 3 years
CREATE VIEW active_p4p WITH (security_invoker = on) AS
SELECT * FROM current_p4p
WHERE date >= CURRENT_DATE - INTERVAL '1095 days';

GRANT SELECT ON active_p4p TO anon, authenticated;
