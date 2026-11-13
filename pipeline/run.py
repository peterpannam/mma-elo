"""
Incremental weekly runner — fetches events not yet in the database, loads new
fighters/events/fights into Supabase, then calculates ELO for any fights not yet
in elo_history.

Data source: Greco1899/scrape_ufc_stats CSVs (see scrape_greco.py). UFCStats.com
itself now blocks ufcscraper with a JavaScript bot check.

Run from the pipeline/ directory:
    python run.py              # full run
    python run.py --dry-run    # fetch + parse + report, no writes

Safe to re-run — all steps are idempotent.

Exits non-zero (failing the GitHub Actions job) when:
  - a fighter in a new fight can't be matched to a UFCStats ID, or
  - the newest event in the database is older than STALE_DAYS (default 21).
    This is what catches a silently broken data source.
"""

import argparse
import logging
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from config import DATA_DIR
from db import get_client
from load import load, refresh_active_status, _fetch_all
from scrape_greco import fetch, GrecoResolutionError
from transform import parse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "run.log"),
    ],
)
logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request is noise
log = logging.getLogger(__name__)

STALE_DAYS = int(os.environ.get("PIPELINE_STALE_DAYS", "21"))


def latest_db_event_date(db) -> date | None:
    r = (
        db.table("events").select("date")
        .lte("date", date.today().isoformat())
        .order("date", desc=True).limit(1).execute()
    )
    return date.fromisoformat(r.data[0]["date"]) if r.data else None


def check_freshness(latest_db: date | None, latest_source: date | None) -> bool:
    """Log and return False if data is older than STALE_DAYS."""
    cutoff = date.today() - timedelta(days=STALE_DAYS)
    log.info("Freshness: newest event in DB = %s, in source = %s, threshold = %d days",
             latest_db, latest_source, STALE_DAYS)
    if latest_db and latest_db >= cutoff:
        return True
    if latest_source is None or latest_source < cutoff:
        log.error(
            "STALE DATA: the data source's newest event is %s (more than %d days ago). "
            "Greco1899/scrape_ufc_stats may have stopped updating — check "
            "https://github.com/Greco1899/scrape_ufc_stats/commits/main",
            latest_source, STALE_DAYS,
        )
    else:
        log.error(
            "STALE DATA: the source has events up to %s but the database only has up to %s. "
            "New events were fetched but not loaded — check the log above.",
            latest_source, latest_db,
        )
    return False


def main(dry_run: bool) -> int:
    log.info("=== Weekly run started%s ===", " (DRY RUN)" if dry_run else "")
    db = get_client()

    log.info("Step 1/5: Fetching new events from Greco1899/scrape_ufc_stats...")
    # An event only counts as loaded once it has fights — an event row can exist
    # with no fights if it was picked up before results were published.
    known_events = {
        (r.get("events") or {}).get("ufcstats_id")
        for r in _fetch_all(db, "fights", "events(ufcstats_id)")
    } - {None}
    known_fighters = {r["ufcstats_id"] for r in _fetch_all(db, "fighters", "ufcstats_id") if r["ufcstats_id"]}
    try:
        scraped = fetch(DATA_DIR, known_events, known_fighters)
    except GrecoResolutionError as e:
        log.error("%s", e)
        return 1
    log.info(
        "New since last run: %d events, %d fights, %d new fighters (source newest event: %s)",
        len(scraped.events), len(scraped.fights), len(scraped.fighters), scraped.latest_source_event,
    )
    for _, ev in scraped.events.iterrows():
        n = (scraped.fights.event_id == ev.event_id).sum()
        log.info("  %s  %s  (%d fights)", ev.event_date, ev.event_name, n)

    log.info("Step 2/5: Transforming to schema...")
    fighters, events, fights = parse(scraped.events, scraped.fights, scraped.fighters)
    log.info("Parsed %d fighters, %d events, %d fights", len(fighters), len(events), len(fights))

    if dry_run:
        projected = max([date.fromisoformat(e.date) for e in events] + [latest_db_event_date(db) or date.min])
        ok = check_freshness(projected if projected != date.min else None, scraped.latest_source_event)
        log.info("=== Dry run complete — nothing written ===")
        return 0 if ok else 1

    # Imported here so --dry-run doesn't need the rankings scraper's deps/network
    from elo import calculate
    from rankings import update as update_rankings

    if events:
        log.info("Step 3/5: Loading into Supabase...")
        load(db, fighters, events, fights)

        log.info("Step 4/5: Calculating ELO history...")
        processed = calculate(db)
        log.info("ELO calculated for %d fights", processed)
    else:
        log.info("Steps 3-4/5: No new events — skipping load and ELO")
        refresh_active_status(db)  # active/inactive is date-based, so refresh anyway

    log.info("Step 5/5: Updating rankings from UFC.com...")
    result = update_rankings(db)
    log.info(
        "Rankings: %d new, %d closed, %d unmatched",
        result["inserted"], result["closed"], result["unmatched"],
    )

    ok = check_freshness(latest_db_event_date(db), scraped.latest_source_event)
    log.info("=== Weekly run complete%s ===", "" if ok else " — WITH ERRORS")
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="fetch and report only; no DB writes")
    sys.exit(main(parser.parse_args().dry_run))
