"""
Fetches UFC data from the Greco1899/scrape_ufc_stats GitHub repo and returns it
in the same DataFrame shape that ufcscraper produced, so transform.parse() works
unchanged.

Why: UFCStats.com now serves a JavaScript bot check that ufcscraper cannot pass
(every run since May 2026 returned "Got 0 event links"). Greco1899 publishes a
weekly CSV refresh of the same UFCStats data, including UFCStats URLs, so the
event/fight/fighter hex IDs match what is already in our database.

The one gap: fight results name fighters as text, not IDs. Names are resolved
against Greco1899's fighter list; ambiguous names (two fighters, same name) are
resolved by division weight and recent activity, and anything still unresolved
raises GrecoResolutionError — add the name to data/greco_name_overrides.json.

Only events NOT already in the database are returned, so historical rows are
never overwritten with data from a different source.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
import requests

log = logging.getLogger(__name__)

GRECO_RAW = "https://raw.githubusercontent.com/Greco1899/scrape_ufc_stats/main"
GRECO_FILES = {
    "events": "ufc_event_details.csv",
    "results": "ufc_fight_results.csv",
    "fighters": "ufc_fighter_details.csv",
    "tott": "ufc_fighter_tott.csv",
}

ACTIVE_WINDOW = timedelta(days=1095)  # same 3-year window as active_elo

# Canonical divisions as ufcscraper stored them (longest first for matching)
_DIVISIONS = sorted(
    [
        "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight",
        "Women's Featherweight", "Light Heavyweight", "Heavyweight",
        "Middleweight", "Welterweight", "Lightweight", "Featherweight",
        "Bantamweight", "Flyweight", "Catch Weight", "Open Weight",
    ],
    key=len,
    reverse=True,
)

# Listed weight (lbs) per division, used to break same-name ties
_DIVISION_WEIGHT = {
    "Flyweight": (125, 125), "Bantamweight": (135, 135),
    "Featherweight": (145, 145), "Lightweight": (155, 155),
    "Welterweight": (170, 170), "Middleweight": (185, 185),
    "Light Heavyweight": (205, 205), "Heavyweight": (206, 265),
    "Women's Strawweight": (115, 115), "Women's Flyweight": (125, 125),
    "Women's Bantamweight": (135, 135), "Women's Featherweight": (145, 145),
}


class GrecoResolutionError(RuntimeError):
    """Raised when one or more fighters in new fights cannot be matched to an ID."""


@dataclass
class ScrapedData:
    events: pd.DataFrame
    fights: pd.DataFrame
    fighters: pd.DataFrame
    latest_source_event: Optional[date] = None
    problems: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _norm(name: str) -> str:
    """Lower-case, strip accents and punctuation spacing for name matching."""
    s = unicodedata.normalize("NFD", str(name))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def _id_from_url(url) -> str:
    return str(url).rstrip("/").rsplit("/", 1)[-1] if pd.notna(url) else ""


def _inches_to_cm(val) -> Optional[float]:
    """'5\\' 11"' or '72"' → cm. '--' → None."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    m = re.fullmatch(r"(\d+)'\s*(\d+)\"?", s)
    if m:
        return round((int(m.group(1)) * 12 + int(m.group(2))) * 2.54, 2)
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\"?", s)
    if m:
        return round(float(m.group(1)) * 2.54, 2)
    return None


def _lbs(val) -> Optional[int]:
    m = re.match(r"(\d+)", str(val)) if pd.notna(val) else None
    return int(m.group(1)) if m else None


def _division(weightclass: str) -> str:
    s = str(weightclass)
    for d in _DIVISIONS:
        if d.lower() in s.lower():
            return d
    if "super heavyweight" in s.lower():
        return "Heavyweight"
    return "Open Weight"  # early UFC tournaments with no division


def _method(raw: str) -> str:
    s = str(raw).strip()
    return "Decision" if s.startswith("Decision") else s


def _download(data_dir: Path) -> dict[str, pd.DataFrame]:
    cache = data_dir / "greco"
    cache.mkdir(parents=True, exist_ok=True)
    frames = {}
    for key, fname in GRECO_FILES.items():
        resp = requests.get(f"{GRECO_RAW}/{fname}", timeout=60)
        resp.raise_for_status()
        path = cache / fname
        path.write_bytes(resp.content)
        frames[key] = pd.read_csv(path, encoding="utf-8")
        log.info("Downloaded %s (%d rows)", fname, len(frames[key]))
    return frames


def _load_overrides(data_dir: Path) -> dict[str, str]:
    path = data_dir / "greco_name_overrides.json"
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {_norm(k): v for k, v in raw.items() if not k.startswith("_")}


def _last_fight_dates(data_dir: Path) -> dict[str, date]:
    """Last fight date per fighter ID from the legacy ufcscraper CSVs (to Apr 2026)."""
    fights_csv, events_csv = data_dir / "fight_data.csv", data_dir / "event_data.csv"
    if not fights_csv.exists() or not events_csv.exists():
        return {}
    f = pd.read_csv(fights_csv, encoding="latin-1", usecols=["event_id", "fighter_1", "fighter_2"])
    e = pd.read_csv(events_csv, encoding="latin-1", usecols=["event_id", "event_date"])
    f = f.merge(e, on="event_id")
    f["event_date"] = pd.to_datetime(f.event_date).dt.date
    out: dict[str, date] = {}
    for col in ("fighter_1", "fighter_2"):
        for fid, d in f.groupby(col).event_date.max().items():
            if fid not in out or d > out[fid]:
                out[fid] = d
    return out


# ---------------------------------------------------------------------------
# Name resolution
# ---------------------------------------------------------------------------

class _Resolver:
    def __init__(self, fighters: pd.DataFrame, tott: pd.DataFrame,
                 overrides: dict[str, str], last_fight: dict[str, date]):
        self.by_name: dict[str, list[str]] = {}
        for _, r in fighters.iterrows():
            fid = _id_from_url(r.URL)
            name = f"{r.FIRST if pd.notna(r.FIRST) else ''} {r.LAST if pd.notna(r.LAST) else ''}"
            self.by_name.setdefault(_norm(name), []).append(fid)
        self.weight = {_id_from_url(r.URL): _lbs(r.WEIGHT) for _, r in tott.iterrows()}
        self.overrides = overrides
        self.last_fight = dict(last_fight)

    def resolve(self, name: str, division: str, on: date) -> tuple[Optional[str], str]:
        key = _norm(name)
        if key in self.overrides:
            return self.overrides[key], ""
        cands = self.by_name.get(key, [])
        if len(cands) == 1:
            return cands[0], ""
        if not cands:
            return None, f"'{name}' not found in Greco1899 fighter list"

        # 1. Listed weight matches the division
        lo_hi = _DIVISION_WEIGHT.get(division)
        if lo_hi:
            by_weight = [c for c in cands if self.weight.get(c) and lo_hi[0] <= self.weight[c] <= lo_hi[1]]
            if len(by_weight) == 1:
                return by_weight[0], ""
            if by_weight:
                cands = by_weight

        # 2. Exactly one candidate active within the last 3 years
        active = [c for c in cands if c in self.last_fight and on - self.last_fight[c] <= ACTIVE_WINDOW]
        if len(active) == 1:
            return active[0], ""

        # 3. Nobody active and exactly one has never fought → a debut
        if not active:
            debut = [c for c in cands if c not in self.last_fight]
            if len(debut) == 1:
                return debut[0], ""

        return None, f"'{name}' is ambiguous ({', '.join(cands)})"

    def record_fight(self, fid: str, on: date) -> None:
        if fid not in self.last_fight or on > self.last_fight[fid]:
            self.last_fight[fid] = on


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch(
    data_dir: Path,
    known_event_ids: Iterable[str],
    known_fighter_ids: Iterable[str] = (),
) -> ScrapedData:
    """
    Return events/fights/fighters for events not in known_event_ids, shaped like
    ufcscraper output. Raises GrecoResolutionError if any fighter can't be matched.

    Fighters already in known_fighter_ids are left out of the fighters frame so
    existing profiles (DOB, height, reach) are never overwritten — Greco1899's
    tale-of-the-tape data is sometimes blank or differs from what we stored.
    """
    known = set(known_event_ids)
    raw = _download(data_dir)
    resolver = _Resolver(raw["fighters"], raw["tott"], _load_overrides(data_dir), _last_fight_dates(data_dir))

    events = raw["events"].copy()
    events["event_id"] = events.URL.map(_id_from_url)
    events["d"] = pd.to_datetime(events.DATE, format="%B %d, %Y").dt.date
    events["EVENT"] = events.EVENT.str.strip()
    latest_source = max(events.d) if len(events) else None

    results = raw["results"].copy()
    results["EVENT"] = results.EVENT.str.strip()

    today = date.today()
    new_events = events[~events.event_id.isin(known) & (events.d <= today)].sort_values("d")

    event_rows, fight_rows, problems = [], [], []
    used_fighters: set[str] = set()

    for _, ev in new_events.iterrows():
        card = results[results.EVENT == ev.EVENT]
        if card.empty:
            log.info("Skipping %s (%s) — no results published yet", ev.EVENT, ev.d)
            continue

        event_rows.append({
            "event_id": ev.event_id,
            "event_name": ev.EVENT,
            "event_date": ev.d.isoformat(),
            # Greco gives "City, State, Country" — transform joins these with ", "
            "event_city": ev.LOCATION, "event_state": "", "event_country": "",
        })

        # Greco lists the main event first; ufcscraper/our card_position expect
        # the first fight of the night first.
        for _, ft in card.iloc[::-1].iterrows():
            parts = [p.strip() for p in str(ft.BOUT).split(" vs. ")]
            if len(parts) != 2:
                problems.append(f"{ev.EVENT}: can't split bout '{ft.BOUT}'")
                continue
            division = _division(ft.WEIGHTCLASS)
            ids = []
            for name in parts:
                fid, err = resolver.resolve(name, division, ev.d)
                if err:
                    problems.append(f"{ev.EVENT} ({ev.d}): {err}")
                ids.append(fid)
            if None in ids:
                continue

            outcome = str(ft.OUTCOME).strip().upper()
            winner = ids[0] if outcome == "W/L" else ids[1] if outcome == "L/W" else ""

            fight_rows.append({
                "fight_id": _id_from_url(ft.URL),
                "event_id": ev.event_id,
                "fighter_1": ids[0],
                "fighter_2": ids[1],
                "winner": winner,
                "weight_class": division,
                "title_fight": "T" if "title" in str(ft.WEIGHTCLASS).lower() else "F",
                "result": _method(ft.METHOD),
                "result_details": str(ft.DETAILS).strip() if pd.notna(ft.DETAILS) else "",
                "finish_round": str(ft.ROUND).strip(),
                "finish_time": str(ft.TIME).strip(),
            })
            for fid in ids:
                used_fighters.add(fid)
                resolver.record_fight(fid, ev.d)

    if problems:
        raise GrecoResolutionError(
            "Could not resolve fighters for new fights — nothing was loaded.\n  "
            + "\n  ".join(problems)
            + "\nAdd the correct ID to pipeline/data/greco_name_overrides.json "
              '(e.g. "Fighter Name": "<ufcstats fighter hex id>").'
        )

    fighters = raw["fighters"].copy()
    fighters["fighter_id"] = fighters.URL.map(_id_from_url)
    tott = raw["tott"].copy()
    tott["fighter_id"] = tott.URL.map(_id_from_url)
    tott = tott.drop_duplicates("fighter_id").set_index("fighter_id")
    fighter_rows = []
    new_fighters = used_fighters - set(known_fighter_ids)
    for _, r in fighters[fighters.fighter_id.isin(new_fighters)].iterrows():
        t = tott.loc[r.fighter_id] if r.fighter_id in tott.index else None
        dob = pd.to_datetime(t.DOB, format="%b %d, %Y", errors="coerce") if t is not None else pd.NaT
        stance = t.STANCE if t is not None and pd.notna(t.STANCE) else ""
        fighter_rows.append({
            "fighter_id": r.fighter_id,
            "fighter_f_name": r.FIRST if pd.notna(r.FIRST) else "",
            "fighter_l_name": r.LAST if pd.notna(r.LAST) else "",
            "fighter_dob": dob.date().isoformat() if pd.notna(dob) else "",
            "fighter_height_cm": _inches_to_cm(t.HEIGHT) if t is not None else None,
            "fighter_reach_cm": _inches_to_cm(t.REACH) if t is not None else None,
            "fighter_stance": stance,
        })

    fight_cols = ["fight_id", "event_id", "fighter_1", "fighter_2", "winner", "weight_class",
                  "title_fight", "result", "result_details", "finish_round", "finish_time"]
    return ScrapedData(
        events=pd.DataFrame(event_rows, columns=["event_id", "event_name", "event_date",
                                                 "event_city", "event_state", "event_country"]),
        fights=pd.DataFrame(fight_rows, columns=fight_cols),
        fighters=pd.DataFrame(fighter_rows, columns=["fighter_id", "fighter_f_name", "fighter_l_name",
                                                     "fighter_dob", "fighter_height_cm",
                                                     "fighter_reach_cm", "fighter_stance"]),
        latest_source_event=latest_source,
    )
