-- current_elo: most recent ELO entry per (fighter, weight_class), joined with fighter name
CREATE OR REPLACE VIEW current_elo WITH (security_invoker = on) AS
SELECT DISTINCT ON (eh.fighter_id, eh.weight_class)
  eh.fighter_id,
  f.name       AS fighter_name,
  eh.weight_class,
  eh.elo_after AS elo,
  eh.date,
  eh.fight_id,
  eh.delta
FROM elo_history eh
JOIN fighters f ON f.id = eh.fighter_id
ORDER BY eh.fighter_id, eh.weight_class, eh.date DESC, eh.id DESC;

GRANT SELECT ON current_elo TO anon, authenticated;

-- division_elo_trend: monthly average ELO per weight class
-- Uses the last ELO entry per fighter per month to avoid double-counting active fighters
CREATE OR REPLACE VIEW division_elo_trend WITH (security_invoker = on) AS
WITH monthly_latest AS (
  SELECT DISTINCT ON (fighter_id, weight_class, date_trunc('month', date::date))
    fighter_id,
    weight_class,
    date_trunc('month', date::date) AS month,
    elo_after
  FROM elo_history
  ORDER BY
    fighter_id,
    weight_class,
    date_trunc('month', date::date),
    date DESC,
    id   DESC
)
SELECT
  month,
  weight_class,
  ROUND(AVG(elo_after))::int       AS avg_elo,
  COUNT(DISTINCT fighter_id)::int  AS fighter_count
FROM monthly_latest
GROUP BY month, weight_class
ORDER BY month, weight_class;

GRANT SELECT ON division_elo_trend TO anon, authenticated;
