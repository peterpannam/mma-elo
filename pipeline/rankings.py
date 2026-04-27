"""
Scrapes current UFC rankings from ufc.com and syncs to the Supabase rankings table.

  rank = 0    → champion
  rank = 1-15 → ranked contenders
  valid_to = NULL → currently active ranking

On change: UPDATE valid_to on old row, INSERT new row.
Unmatched fighter names are written to data/unmatched_rankings.json for manual review.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from supabase import Client

log = logging.getLogger(__name__)

_URL = "https://www.ufc.com/rankings"
_UNMATCHED_PATH = Path(__file__).parent / "data" / "unmatched_rankings.json"

# Exact header strings used by UFC.com for each division we track.
# P4P headers contain "Pound" and are skipped before this lookup.
_KNOWN_WEIGHT_CLASSES = {
    "Flyweight",
    "Bantamweight",
    "Featherweight",
    "Lightweight",
    "Welterweight",
    "Middleweight",
    "Light Heavyweight",
    "Heavyweight",
    "Women's Strawweight",
    "Women's Flyweight",
    "Women's Bantamweight",
    "Women's Featherweight",
}

_BATCH = 200


def _normalize(name: str) -> str:
    """Lowercase, strip accents, strip non-alphanumeric except spaces."""
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^a-z0-9 ]", "", name.lower())
    return re.sub(r"\s+", " ", name).strip()


def _scrape() -> list[dict]:
    """
    Fetch UFC.com rankings page and return [{weight_class, rank, name}].
    rank=0 means champion. P4P tables are skipped.
    """
    resp = requests.get(
        _URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; mma-elo/1.0)"},
        timeout=30,
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    results: list[dict] = []

    for group in soup.select("div.view-grouping"):
        header = group.select_one("div.view-grouping-header")
        if not header:
            continue

        # get_text with separator strips child <span> elements cleanly
        wc = header.get_text(" ", strip=True)
        # "Men's Pound-for-Pound Top Rank" → strip the " Top Rank" suffix
        wc = re.sub(r"\s+Top Rank$", "", wc).strip()

        if "Pound" in wc:
            wc = "Women's P4P" if "Women" in wc else "P4P"
        elif wc not in _KNOWN_WEIGHT_CLASSES:
            log.warning("Unrecognised weight class on UFC.com: %r — skipping", wc)
            continue

        # Champion lives in the <caption>
        champion_link = group.select_one("caption div.info h5 a")
        if champion_link:
            results.append({
                "weight_class": wc,
                "rank": 0,
                "name": champion_link.get_text(strip=True),
            })

        # Ranked contenders in <tbody>
        for row in group.select("tbody tr"):
            rank_td = row.select_one("td.views-field-weight-class-rank")
            name_link = row.select_one("td.views-field-title a")
            if not rank_td or not name_link:
                continue
            rank_text = rank_td.get_text(strip=True)
            if rank_text.isdigit():
                results.append({
                    "weight_class": wc,
                    "rank": int(rank_text),
                    "name": name_link.get_text(strip=True),
                })

    return results


def _fetch_all(db: Client, table: str, select: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    page = 1000
    while True:
        result = db.table(table).select(select).range(offset, offset + page - 1).execute()
        rows.extend(result.data)
        if len(result.data) < page:
            break
        offset += page
    return rows


def update(db: Client) -> dict:
    """
    Sync current rankings snapshot to Supabase.
    Returns {"inserted": n, "closed": n, "unmatched": n}.
    """
    today = date.today().isoformat()

    scraped = _scrape()
    log.info("Scraped %d ranking entries from UFC.com", len(scraped))

    # Build normalized name → UUID map from fighters table
    all_fighters = _fetch_all(db, "fighters", "id, name")
    name_map: dict[str, str] = {
        _normalize(f["name"]): f["id"]
        for f in all_fighters
        if f["name"]
    }

    # Apply manual overrides: {"UFC.com name": "UFCStats name as in DB"}
    overrides_path = Path(__file__).parent / "data" / "name_overrides.json"
    if overrides_path.exists():
        with open(overrides_path, encoding="utf-8") as f:
            overrides: dict[str, str] = json.load(f)
        for ufc_name, ufcstats_name in overrides.items():
            fid = name_map.get(_normalize(ufcstats_name))
            if fid:
                name_map[_normalize(ufc_name)] = fid
            else:
                log.warning("Override target %r not found in fighters table", ufcstats_name)

    matched: list[dict] = []
    unmatched: list[dict] = []
    for entry in scraped:
        fid = name_map.get(_normalize(entry["name"]))
        if fid:
            matched.append({**entry, "fighter_id": fid})
        else:
            unmatched.append(entry)

    if unmatched:
        _UNMATCHED_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_UNMATCHED_PATH, "w", encoding="utf-8") as f:
            json.dump(unmatched, f, indent=2, ensure_ascii=False)
        log.warning(
            "%d fighters not matched — written to %s",
            len(unmatched), _UNMATCHED_PATH,
        )

    # Fetch active rankings (valid_to IS NULL)
    active_rows = (
        db.table("rankings")
        .select("id, fighter_id, weight_class, rank")
        .is_("valid_to", "null")
        .execute()
        .data
    )
    active: dict[tuple, dict] = {
        (r["fighter_id"], r["weight_class"]): {"id": r["id"], "rank": r["rank"]}
        for r in active_rows
    }

    scraped_set: dict[tuple, int] = {
        (e["fighter_id"], e["weight_class"]): e["rank"]
        for e in matched
    }

    to_close: list[str] = []
    to_insert: list[dict] = []

    # New entries or rank changes
    for (fid, wc), rank in scraped_set.items():
        current = active.get((fid, wc))
        if current is None or current["rank"] != rank:
            if current:
                to_close.append(current["id"])
            to_insert.append({
                "fighter_id": fid,
                "weight_class": wc,
                "rank": rank,
                "valid_from": today,
                "valid_to": None,
            })

    # Fighters who dropped out of rankings entirely
    for (fid, wc), current in active.items():
        if (fid, wc) not in scraped_set:
            to_close.append(current["id"])

    if to_close:
        db.table("rankings").update({"valid_to": today}).in_("id", to_close).execute()

    for i in range(0, len(to_insert), _BATCH):
        db.table("rankings").insert(to_insert[i : i + _BATCH]).execute()

    log.info(
        "Rankings: %d inserted, %d closed, %d unmatched",
        len(to_insert), len(to_close), len(unmatched),
    )
    return {"inserted": len(to_insert), "closed": len(to_close), "unmatched": len(unmatched)}
