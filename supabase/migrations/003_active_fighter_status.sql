-- Derive active status from last fight date.
-- A fighter is "active" if they have fought within the last 3 years (1095 days).
-- This catches departed fighters like Ngannou while giving injured/suspended
-- fighters (e.g. Jones) enough runway.

-- Function called by the Python pipeline after each weekly load.
CREATE OR REPLACE FUNCTION refresh_fighter_status()
RETURNS void
LANGUAGE sql
AS $$
  -- Set status based on most recent fight date across all weight classes
  UPDATE fighters f
  SET status = CASE
    WHEN last_fight.max_date >= CURRENT_DATE - INTERVAL '1095 days' THEN 'active'
    ELSE 'inactive'
  END
  FROM (
    SELECT fighter_id, MAX(date) AS max_date
    FROM elo_history
    GROUP BY fighter_id
  ) last_fight
  WHERE last_fight.fighter_id = f.id;

  -- Fighters with no fight history at all are inactive
  UPDATE fighters
  SET status = 'inactive'
  WHERE id NOT IN (SELECT DISTINCT fighter_id FROM elo_history);
$$;

GRANT EXECUTE ON FUNCTION refresh_fighter_status TO authenticated, service_role;

-- Populate immediately for existing data
SELECT refresh_fighter_status();

-- Rebuild current_elo to include fighter_status
-- Must drop first — CREATE OR REPLACE cannot reorder/insert columns
DROP VIEW IF EXISTS active_elo;
DROP VIEW IF EXISTS current_elo;

CREATE VIEW current_elo WITH (security_invoker = on) AS
SELECT DISTINCT ON (eh.fighter_id, eh.weight_class)
  eh.fighter_id,
  f.name       AS fighter_name,
  f.status     AS fighter_status,
  eh.weight_class,
  eh.elo_after AS elo,
  eh.date,
  eh.fight_id,
  eh.delta
FROM elo_history eh
JOIN fighters f ON f.id = eh.fighter_id
ORDER BY eh.fighter_id, eh.weight_class, eh.date DESC, eh.id DESC;

GRANT SELECT ON current_elo TO anon, authenticated;

-- active_elo: current_elo filtered to active fighters only
CREATE VIEW active_elo WITH (security_invoker = on) AS
SELECT * FROM current_elo WHERE fighter_status = 'active';

GRANT SELECT ON active_elo TO anon, authenticated;
