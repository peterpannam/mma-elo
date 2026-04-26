-- Add URL-friendly slug column to fighters
-- Slugs are derived from fighter names: lowercase, non-alphanumeric → hyphens.
-- unaccent() normalises accented characters (José → jose) so slugs are ASCII-safe.
-- Duplicate slugs get a numeric suffix (-2, -3 …).

ALTER TABLE fighters ADD COLUMN slug TEXT;

UPDATE fighters
SET slug = trim('-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'));

-- Deduplicate: append row number for any collision
WITH ranked AS (
  SELECT id,
         slug,
         row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM fighters
)
UPDATE fighters f
SET slug = r.slug || '-' || r.rn
FROM ranked r
WHERE f.id = r.id AND r.rn > 1;

ALTER TABLE fighters ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX fighters_slug_idx ON fighters (slug);

-- ----------------------------------------------------------------
-- Rebuild all four ELO views to expose fighter_slug.
-- Must drop in dependency order.
-- ----------------------------------------------------------------

DROP VIEW IF EXISTS active_p4p;
DROP VIEW IF EXISTS current_p4p;
DROP VIEW IF EXISTS active_elo;
DROP VIEW IF EXISTS current_elo;

CREATE VIEW current_elo WITH (security_invoker = on) AS
SELECT DISTINCT ON (eh.fighter_id, eh.weight_class)
  eh.fighter_id,
  f.name        AS fighter_name,
  f.slug        AS fighter_slug,
  f.status      AS fighter_status,
  eh.weight_class,
  eh.elo_after  AS elo,
  eh.date,
  eh.fight_id,
  eh.delta
FROM elo_history eh
JOIN fighters f ON f.id = eh.fighter_id
ORDER BY eh.fighter_id, eh.weight_class, eh.date DESC, eh.id DESC;

CREATE VIEW active_elo WITH (security_invoker = on) AS
SELECT * FROM current_elo
WHERE date >= CURRENT_DATE - INTERVAL '1095 days';

CREATE VIEW current_p4p WITH (security_invoker = on) AS
SELECT DISTINCT ON (eh.fighter_id)
  eh.fighter_id,
  f.name        AS fighter_name,
  f.slug        AS fighter_slug,
  f.status      AS fighter_status,
  eh.p4p_elo_after AS elo,
  eh.date,
  eh.fight_id,
  eh.p4p_delta  AS delta
FROM elo_history eh
JOIN fighters f ON f.id = eh.fighter_id
WHERE eh.p4p_elo_after IS NOT NULL
ORDER BY eh.fighter_id, eh.date DESC, eh.id DESC;

CREATE VIEW active_p4p WITH (security_invoker = on) AS
SELECT * FROM current_p4p
WHERE date >= CURRENT_DATE - INTERVAL '1095 days';

GRANT SELECT ON current_elo TO anon, authenticated;
GRANT SELECT ON active_elo  TO anon, authenticated;
GRANT SELECT ON current_p4p TO anon, authenticated;
GRANT SELECT ON active_p4p  TO anon, authenticated;
