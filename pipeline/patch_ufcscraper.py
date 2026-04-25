"""
Monkey-patches for ufcscraper Windows compatibility.

1. links_to_soups — replaces multiprocessing worker (unpicklable lambda on Windows)
   with a sequential single-session version.

2. remove_duplicates_from_file / load_data — adds encoding='latin-1' to all
   pd.read_csv calls. ufcscraper appends rows via csv.writer using the Windows
   system default encoding (cp1252), but pandas defaults to UTF-8 when reading
   back, causing UnicodeDecodeError on accented characters in fighter names.

This module must be imported BEFORE any ufcscraper scrapers are imported.
"""

import pandas as pd
import ufcscraper.utils as _utils
import ufcscraper.base as _base


# ---------------------------------------------------------------------------
# Patch 1: sequential scraping (no multiprocessing)
# ---------------------------------------------------------------------------

def _links_to_soups_sequential(urls, n_sessions=1, delay=0):
    session = _utils.get_session()
    try:
        for url in urls:
            yield url, _utils.link_to_soup(url, session, delay)
    finally:
        session.close()


_utils.links_to_soups = _links_to_soups_sequential


# ---------------------------------------------------------------------------
# Patch 2: encoding-safe CSV reads
# ---------------------------------------------------------------------------

def _remove_duplicates_from_file(self) -> None:
    date_columns = [
        col for col, dtype in self.dtypes.items() if dtype == "datetime64[ns]"
    ]
    non_date_types = {
        col: dtype
        for col, dtype in self.dtypes.items()
        if dtype != "datetime64[ns]"
    }
    data = pd.read_csv(
        self.data_file,
        dtype=non_date_types,
        parse_dates=date_columns,
        encoding="latin-1",
    ).drop_duplicates()
    data = data.sort_values(by=self.sort_fields).reset_index(drop=True)
    data.to_csv(self.data_file, index=False, encoding="utf-8")


def _load_data(self) -> None:
    date_columns = [
        col for col, dtype in self.dtypes.items() if dtype == "datetime64[ns]"
    ]
    non_date_types = {
        col: dtype
        for col, dtype in self.dtypes.items()
        if dtype != "datetime64[ns]"
    }
    self.data = pd.read_csv(
        self.data_file,
        dtype=non_date_types,
        parse_dates=date_columns,
        encoding="latin-1",
    ).drop_duplicates()


_base.BaseFileHandler.remove_duplicates_from_file = _remove_duplicates_from_file
_base.BaseFileHandler.load_data = _load_data
