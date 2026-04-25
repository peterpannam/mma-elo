"""
Maps ufcscraper DataFrames to plain dicts ready for Supabase upsert.

ufcscraper column reference
  events:  event_id, event_name, event_date, event_city, event_state, event_country
  fights:  fight_id, event_id, fighter_1, fighter_2, winner, weight_class,
           title_fight, result, result_details, finish_round, finish_time
  fighters: fighter_id, fighter_f_name, fighter_l_name, fighter_dob, (+ others)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Intermediate types
# ---------------------------------------------------------------------------

@dataclass
class ParsedFighter:
    ufcstats_id: str
    name: str
    date_of_birth: Optional[str]
    # weight_class intentionally absent — division lives on elo_history + fights
    # nationality not available from UFCStats


@dataclass
class ParsedEvent:
    ufcstats_id: str
    name: str
    date: str
    location: str


@dataclass
class ParsedFight:
    ufcstats_id: str
    ufcstats_event_id: str
    fighter_1_ufcstats_id: str   # UFCStats hex fighter ID (not name)
    fighter_2_ufcstats_id: str
    winner_ufcstats_id: Optional[str]  # None → draw / no contest
    method: Optional[str]
    round: Optional[int]
    time: Optional[str]
    weight_class: str
    is_title_fight: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NULL_WINNER_MARKERS = {"draw", "nc", "no contest", ""}


def _str(val) -> str:
    s = str(val) if pd.notna(val) else ""
    return "" if s.lower() == "nan" else s


def _location(city, state, country) -> str:
    return ", ".join(p for p in [_str(city), _str(state), _str(country)] if p)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse(
    events: pd.DataFrame,
    fights: pd.DataFrame,
    fighters: pd.DataFrame,
) -> tuple[list[ParsedFighter], list[ParsedEvent], list[ParsedFight]]:

    parsed_fighters = [
        ParsedFighter(
            ufcstats_id=_str(row.fighter_id),
            name=f"{_str(row.fighter_f_name)} {_str(row.fighter_l_name)}".strip(),
            date_of_birth=_str(row.fighter_dob) or None,
        )
        for _, row in fighters.iterrows()
        if _str(row.fighter_id)
    ]

    parsed_events = [
        ParsedEvent(
            ufcstats_id=_str(row.event_id),
            name=_str(row.event_name),
            date=_str(row.event_date),
            location=_location(row.event_city, row.event_state, row.event_country),
        )
        for _, row in events.iterrows()
        if _str(row.event_id)
    ]

    parsed_fights: list[ParsedFight] = []
    for _, row in fights.iterrows():
        if not _str(row.fight_id):
            continue

        winner_raw = _str(row.winner).strip()
        winner_ufcstats_id = None if winner_raw.lower() in _NULL_WINNER_MARKERS else winner_raw

        finish_round = _str(row.finish_round)
        parsed_fights.append(ParsedFight(
            ufcstats_id=_str(row.fight_id),
            ufcstats_event_id=_str(row.event_id),
            fighter_1_ufcstats_id=_str(row.fighter_1),
            fighter_2_ufcstats_id=_str(row.fighter_2),
            winner_ufcstats_id=winner_ufcstats_id,
            method=_str(row.result) or None,
            round=int(finish_round) if finish_round.isdigit() else None,
            time=_str(row.finish_time) or None,
            weight_class=_str(row.weight_class) or "Unknown",
            is_title_fight=str(row.title_fight).strip().lower() in ("true", "1", "yes")
            if pd.notna(row.title_fight) else False,
        ))

    return parsed_fighters, parsed_events, parsed_fights
