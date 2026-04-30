-- Replaces the all-fighters monthly average with a top-15 average.
-- For each (weight_class, month) we reconstruct each fighter's ELO *as of*
-- that month (their most recent fight up to and including that month), rank
-- them, take the top 15, and average. Also captures the #1 ELO per division
-- per month so the frontend can overlay a "best fighter" line.
--
-- Implemented as a MATERIALIZED VIEW so the lateral join only runs at
-- refresh time (weekly, via refresh_division_trends()). The old
-- division_elo_trend regular view is kept for backwards-compatibility.

CREATE MATERIALIZED VIEW division_trend_top15 AS
WITH months AS (
  SELECT DISTINCT
    weight_class,
    date_trunc('month', date::date)::date AS month
  FROM elo_history
  WHERE elo_after IS NOT NULL
),
top15 AS (
  SELECT
    m.weight_class,
    m.month,
    f.elo_after,
    ROW_NUMBER() OVER (
      PARTITION BY m.weight_class, m.month
      ORDER BY f.elo_after DESC
    ) AS rnk
  FROM months m
  CROSS JOIN LATERAL (
    -- For each (division, month): each fighter's most recent ELO up to that month
    SELECT DISTINCT ON (fighter_id)
      fighter_id,
      elo_after
    FROM elo_history
    WHERE weight_class = m.weight_class
      AND date_trunc('month', date::date)::date <= m.month
      AND elo_after IS NOT NULL
    ORDER BY fighter_id, date DESC, id DESC
  ) f
)
SELECT
  weight_class,
  month,
  ROUND(AVG(elo_after))::int  AS avg_elo,
  MAX(CASE WHEN rnk = 1 THEN elo_after END)::int AS top_elo,
  COUNT(*)::int                AS fighter_count
FROM top15
WHERE rnk <= 15
GROUP BY weight_class, month
ORDER BY weight_class, month;

CREATE INDEX ON division_trend_top15 (weight_class, month);

GRANT SELECT ON division_trend_top15 TO anon, authenticated;

-- Called by the pipeline after each weekly load (alongside refresh_fighter_status)
CREATE OR REPLACE FUNCTION refresh_division_trends()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW division_trend_top15;
$$;
