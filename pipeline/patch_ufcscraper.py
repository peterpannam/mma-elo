"""
Monkey-patch ufcscraper.utils.links_to_soups with a sequential, single-process
version. ufcscraper's default implementation uses multiprocessing.Process with
a lambda worker, which cannot be pickled on Windows (spawn start method).

This module must be imported BEFORE any ufcscraper scrapers are imported.
On Linux (GitHub Actions), multiprocessing works fine so this is a no-op on
that platform if desired — but the sequential version is safe everywhere and
fast enough for a weekly pipeline scraping ~700 events total.
"""

import ufcscraper.utils as _utils


def _links_to_soups_sequential(urls, n_sessions=1, delay=0):
    session = _utils.get_session()
    try:
        for url in urls:
            yield url, _utils.link_to_soup(url, session, delay)
    finally:
        session.close()


_utils.links_to_soups = _links_to_soups_sequential
