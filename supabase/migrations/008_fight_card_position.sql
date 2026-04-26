-- Add card_position to preserve within-event fight order from ufcscraper.
-- ufcscraper returns fights in chronological fight-night order (early prelim = 0, main event = highest).
-- Sorting by card_position DESC gives broadcast/card order (main event first).

ALTER TABLE fights ADD COLUMN IF NOT EXISTS card_position SMALLINT;
