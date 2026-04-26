"""
Wipe and regenerate elo_history from the existing fights table.

Use this whenever:
  - The ELO formula or K-factor changes
  - elo_history contains corrupt/inconsistent rows (e.g. from a partial backfill)
  - You want a clean replay after fixing fight data

This script does NOT re-scrape or re-load fight data. The fights, fighters,
and events tables are left untouched. Only elo_history is affected.

Run from the pipeline/ directory:
    python recalculate.py

Add --dry-run to see the fight count without writing anything:
    python recalculate.py --dry-run
"""

import argparse
import logging
import sys
from pathlib import Path

from db import get_client
from elo import calculate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "recalculate.log"),
    ],
)
log = logging.getLogger(__name__)


def _count_fights(db) -> int:
    result = db.table("fights").select("id", count="exact").execute()
    return result.count or 0


def _count_elo_rows(db) -> int:
    result = db.table("elo_history").select("id", count="exact").execute()
    return result.count or 0


def _truncate_elo_history(db) -> None:
    # DELETE with a always-true filter — Supabase REST does not expose TRUNCATE,
    # but a full-table DELETE via the service role key achieves the same result.
    db.table("elo_history").delete().gte("id", "00000000-0000-0000-0000-000000000000").execute()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe and regenerate elo_history.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count fights and rows without deleting or recalculating.",
    )
    args = parser.parse_args()

    db = get_client()

    fight_count = _count_fights(db)
    elo_row_count = _count_elo_rows(db)
    log.info("Fights in DB: %d", fight_count)
    log.info("elo_history rows to be deleted: %d", elo_row_count)

    if args.dry_run:
        log.info("Dry run — no changes made.")
        sys.exit(0)

    confirm = input(
        f"\nThis will DELETE all {elo_row_count} elo_history rows and recalculate "
        f"from {fight_count} fights.\nType YES to continue: "
    )
    if confirm.strip() != "YES":
        log.info("Aborted.")
        sys.exit(0)

    log.info("=== Recalculate started ===")

    log.info("Step 1/2: Wiping elo_history...")
    _truncate_elo_history(db)
    log.info("elo_history cleared.")

    log.info("Step 2/2: Recalculating ELO for all fights...")
    processed = calculate(db)
    log.info("ELO calculated for %d fights.", processed)

    log.info("=== Recalculate complete ===")
