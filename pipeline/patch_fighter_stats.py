"""
One-off script to backfill height_cm, reach_cm, and stance on existing fighters.

Reads the already-scraped fighter_data.csv (no network requests) and re-upserts
every fighter row. Safe to run multiple times — upsert is idempotent on ufcstats_id.

Run from the pipeline/ directory:
    python patch_fighter_stats.py
"""

import logging
import sys
from pathlib import Path

import patch_ufcscraper  # must be first

import pandas as pd
from ufcscraper.fighter_scraper import FighterScraper

from config import DATA_DIR
from db import get_client
from transform import ParsedFighter, _str

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

if __name__ == "__main__":
    log.info("Loading fighter CSV from %s", DATA_DIR)
    scraper = FighterScraper(data_folder=DATA_DIR, n_sessions=1, delay=0)
    scraper.load_data()
    scraper.add_name_column()
    df = scraper.data
    log.info("Loaded %d fighters from CSV", len(df))

    parsed = [
        ParsedFighter(
            ufcstats_id=_str(row.fighter_id),
            name=f"{_str(row.fighter_f_name)} {_str(row.fighter_l_name)}".strip(),
            date_of_birth=_str(row.fighter_dob) or None,
            height_cm=float(row.fighter_height_cm) if pd.notna(row.fighter_height_cm) and row.fighter_height_cm else None,
            reach_cm=float(row.fighter_reach_cm) if pd.notna(row.fighter_reach_cm) and row.fighter_reach_cm else None,
            stance=_str(row.fighter_stance) or None,
        )
        for _, row in df.iterrows()
        if _str(row.fighter_id)
    ]

    db = get_client()

    # Fetch existing (ufcstats_id → slug) map from DB, paginated.
    # We must include slug in the upsert payload: PostgreSQL checks NOT NULL before the
    # ON CONFLICT branch fires, so omitting slug causes an INSERT failure even for existing rows.
    slug_map: dict[str, str] = {}
    offset = 0
    while True:
        result = db.table("fighters").select("ufcstats_id, slug").range(offset, offset + 999).execute()
        for row in result.data:
            if row["ufcstats_id"] and row["slug"]:
                slug_map[row["ufcstats_id"]] = row["slug"]
        if len(result.data) < 1000:
            break
        offset += 1000

    log.info("Found %d existing fighters in DB", len(slug_map))

    rows = [
        {
            "ufcstats_id": f.ufcstats_id,
            "name": f.name,
            "date_of_birth": f.date_of_birth,
            "height_cm": f.height_cm,
            "reach_cm": f.reach_cm,
            "stance": f.stance,
            "slug": slug_map[f.ufcstats_id],
        }
        for f in parsed
        if f.ufcstats_id in slug_map
    ]
    skipped = len(parsed) - len(rows)
    log.info("Upserting %d fighters (skipping %d not yet in DB)", len(rows), skipped)

    batch_size = 200
    for i in range(0, len(rows), batch_size):
        db.table("fighters").upsert(rows[i:i + batch_size], on_conflict="ufcstats_id").execute()

    log.info("Done")
