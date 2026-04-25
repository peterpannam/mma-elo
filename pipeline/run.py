"""
Incremental weekly runner — scrapes only new events since the last run,
loads new fighters/events/fights into Supabase, then calculates ELO for
any fights not yet in elo_history.

Run from the pipeline/ directory:
    python run.py

Safe to re-run — all steps are idempotent.
"""

import logging
import sys
from pathlib import Path

import patch_ufcscraper  # must be first — patches links_to_soups before scrapers load

from config import DATA_DIR
from db import get_client
from scrape import fetch
from transform import parse
from load import load
from elo import calculate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "run.log"),
    ],
)
log = logging.getLogger(__name__)


if __name__ == "__main__":
    log.info("=== Weekly run started ===")

    log.info("Step 1/4: Scraping new events, fights, and fighters from UFCStats.com...")
    scraped = fetch(DATA_DIR, all_events=False)
    log.info(
        "Scraped %d events, %d fights, %d fighters",
        len(scraped.events),
        len(scraped.fights),
        len(scraped.fighters),
    )

    log.info("Step 2/4: Transforming to schema...")
    fighters, events, fights = parse(scraped.events, scraped.fights, scraped.fighters)
    log.info(
        "Parsed %d fighters, %d events, %d fights",
        len(fighters), len(events), len(fights),
    )

    log.info("Step 3/4: Loading into Supabase...")
    db = get_client()
    load(db, fighters, events, fights)

    log.info("Step 4/4: Calculating ELO history...")
    processed = calculate(db)
    log.info("ELO calculated for %d fights", processed)

    log.info("=== Weekly run complete ===")
