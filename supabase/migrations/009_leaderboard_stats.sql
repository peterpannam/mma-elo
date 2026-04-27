-- Per-division fighter stats for the leaderboard table:
-- peak_elo, wins/losses/draws, last 5 deltas, 5-fight trend, date_of_birth
--
-- Uses LEFT JOIN on fights so fighters whose elo_history contains any unmatched
-- fight_ids (data gaps, retroactive additions) still appear. Draws are counted
-- only when the fights row was found (f.id IS NOT NULL) and winner_id IS NULL.
CREATE OR REPLACE VIEW fighter_division_stats WITH (security_invoker = on) AS
WITH ranked AS (
  SELECT
    eh.fighter_id,
    eh.weight_class,
    eh.delta,
    eh.elo_after,
    f.id        AS fight_row_id,
    f.winner_id,
    ROW_NUMBER() OVER (
      PARTITION BY eh.fighter_id, eh.weight_class
      ORDER BY eh.date DESC, eh.id DESC
    ) AS rn
  FROM elo_history eh
  LEFT JOIN fights f ON f.id = eh.fight_id
)
SELECT
  r.fighter_id,
  r.weight_class,
  MAX(r.elo_after)                                                                                       AS peak_elo,
  COUNT(*) FILTER (WHERE r.winner_id = r.fighter_id)::int                                              AS wins,
  COUNT(*) FILTER (WHERE r.winner_id IS NOT NULL AND r.winner_id != r.fighter_id)::int                 AS losses,
  COUNT(*) FILTER (WHERE r.fight_row_id IS NOT NULL AND r.winner_id IS NULL)::int                      AS draws,
  json_agg(r.delta ORDER BY r.rn) FILTER (WHERE r.rn <= 5)                                             AS last_5_deltas,
  COALESCE(SUM(r.delta) FILTER (WHERE r.rn <= 5), 0)::int                                              AS trend_5,
  fi.date_of_birth
FROM ranked r
JOIN fighters fi ON fi.id = r.fighter_id
GROUP BY r.fighter_id, r.weight_class, fi.date_of_birth;

GRANT SELECT ON fighter_division_stats TO anon, authenticated;

-- Career-wide stats for P4P leaderboard
CREATE OR REPLACE VIEW fighter_career_stats WITH (security_invoker = on) AS
WITH ranked AS (
  SELECT
    eh.fighter_id,
    eh.delta,
    eh.p4p_elo_after,
    f.id        AS fight_row_id,
    f.winner_id,
    ROW_NUMBER() OVER (
      PARTITION BY eh.fighter_id
      ORDER BY eh.date DESC, eh.id DESC
    ) AS rn
  FROM elo_history eh
  LEFT JOIN fights f ON f.id = eh.fight_id
)
SELECT
  r.fighter_id,
  MAX(r.p4p_elo_after)                                                                                  AS peak_elo,
  COUNT(*) FILTER (WHERE r.winner_id = r.fighter_id)::int                                              AS wins,
  COUNT(*) FILTER (WHERE r.winner_id IS NOT NULL AND r.winner_id != r.fighter_id)::int                 AS losses,
  COUNT(*) FILTER (WHERE r.fight_row_id IS NOT NULL AND r.winner_id IS NULL)::int                      AS draws,
  json_agg(r.delta ORDER BY r.rn) FILTER (WHERE r.rn <= 5)                                             AS last_5_deltas,
  COALESCE(SUM(r.delta) FILTER (WHERE r.rn <= 5), 0)::int                                              AS trend_5,
  fi.date_of_birth
FROM ranked r
JOIN fighters fi ON fi.id = r.fighter_id
GROUP BY r.fighter_id, fi.date_of_birth;

GRANT SELECT ON fighter_career_stats TO anon, authenticated;
