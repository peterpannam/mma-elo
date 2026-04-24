"""
Quick smoke test — scrapes the 5 most recent events from UFCStats.com
and prints the raw DataFrame. No DB connection needed.

Run from the pipeline/ directory:
    python test_scrape.py
"""

import patch_ufcscraper  # must be first

from pathlib import Path
from ufcscraper.event_scraper import EventScraper

if __name__ == "__main__":
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)

    print("Fetching events from UFCStats.com...")
    # n_sessions=1 avoids Windows multiprocessing pickling issues
    scraper = EventScraper(data_folder=data_dir, n_sessions=1, delay=0.5)
    scraper.scrape_events()

    df = scraper.data
    print(f"\nTotal events scraped: {len(df)}")
    print("\nMost recent 5 events:")
    print(df.sort_values("event_date", ascending=False).head(5).to_string(index=False))
