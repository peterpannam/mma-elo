"""
One-off script to backfill card_position on existing fights.

Reads the already-scraped CSVs (no network requests), re-upserts fights with
their within-event card_position. Does NOT recalculate ELO.

Run from the pipeline/ directory after running migration 008_fight_card_position.sql:
    python patch_card_positions.py
"""

import logging
import sys

import patch_ufcscraper  # must be first

from ufcscraper.event_scraper import EventScraper
from ufcscraper.fight_scraper import FightScraper
from ufcscraper.fighter_scraper import FighterScraper

from config import DATA_DIR
from db import get_client
from transform import parse
from load import upsert_fighters, upsert_events, upsert_fights

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

if __name__ == "__main__":
    log.info("Loading existing CSVs from %s (no scraping)", DATA_DIR)

    event_scraper = EventScraper(data_folder=DATA_DIR, n_sessions=1, delay=0)
    event_scraper.load_data()

    fight_scraper = FightScraper(data_folder=DATA_DIR, n_sessions=1, delay=0)
    fight_scraper.load_data()

    fighter_scraper = FighterScraper(data_folder=DATA_DIR, n_sessions=1, delay=0)
    fighter_scraper.load_data()
    fighter_scraper.add_name_column()

    log.info("Loaded %d events, %d fights, %d fighters",
             len(event_scraper.data), len(fight_scraper.data), len(fighter_scraper.data))

    fighters, events, fights = parse(event_scraper.data, fight_scraper.data, fighter_scraper.data)
    log.info("Parsed %d fighters, %d events, %d fights", len(fighters), len(events), len(fights))

    db = get_client()

    # Upsert fighters + events first so FK lookups succeed in upsert_fights
    fighter_id_map = upsert_fighters(db, fighters)
    event_id_map = upsert_events(db, events)

    upsert_fights(db, fights, fighter_id_map, event_id_map)
    log.info("Done — card_position backfilled for %d fights", len(fights))
