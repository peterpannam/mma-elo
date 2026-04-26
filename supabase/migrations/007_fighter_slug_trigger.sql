-- Auto-generate slug on INSERT when slug is not provided.
-- Fires BEFORE INSERT so the NOT NULL constraint is satisfied.
-- Does not fire on UPDATE, so existing slugs are never overwritten.
--
-- Slug format: lowercase name, non-alphanumeric chars → hyphens, leading/trailing hyphens trimmed.
-- Uniqueness: appends -2, -3 … until no collision.

CREATE OR REPLACE FUNCTION generate_fighter_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  candidate  TEXT;
  counter    INT := 2;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base_slug := trim('-' FROM regexp_replace(lower(NEW.name), '[^a-z0-9]+', '-', 'g'));
  candidate  := base_slug;

  WHILE EXISTS (SELECT 1 FROM fighters WHERE slug = candidate) LOOP
    candidate := base_slug || '-' || counter;
    counter   := counter + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fighter_slug_before_insert
  BEFORE INSERT ON fighters
  FOR EACH ROW
  EXECUTE FUNCTION generate_fighter_slug();
