import patch_ufcscraper  # must be first — patches links_to_soups before scrapers load

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from ufcscraper.event_scraper import EventScraper
from ufcscraper.fight_scraper import FightScraper
from ufcscraper.fighter_scraper import FighterScraper


@dataclass
class ScrapedData:
    events: pd.DataFrame
    fights: pd.DataFrame
    fighters: pd.DataFrame


def fetch(data_dir: Path, all_events: bool = False) -> ScrapedData:
    """
    Pull UFC data from UFCStats.com via ufcscraper.

    all_events=True  → backfill (fetches every event ever recorded)
    all_events=False → incremental (only events not yet in data_dir CSVs)
    """
    # n_sessions=1 avoids Windows multiprocessing pickling issues with ufcscraper's
    # worker_constructor closure. On Linux (GitHub Actions) this could be raised safely.
    event_scraper = EventScraper(data_folder=data_dir, n_sessions=1, delay=0.3)
    event_scraper.scrape_events()
    event_scraper.load_data()  # scraper.data is set at __init__ and not refreshed after scraping

    fight_scraper = FightScraper(data_folder=data_dir, n_sessions=1, delay=0.3)
    fight_scraper.scrape_fights(get_all_events=all_events)
    fight_scraper.load_data()

    fighter_scraper = FighterScraper(data_folder=data_dir, n_sessions=1, delay=0.3)
    fighter_scraper.scrape_fighters()
    fighter_scraper.load_data()
    fighter_scraper.add_name_column()

    return ScrapedData(
        events=event_scraper.data,
        fights=fight_scraper.data,
        fighters=fighter_scraper.data,
    )
