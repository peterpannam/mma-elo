"""
Upserts parsed UFC data into Supabase.

Execution order matters:
  1. fighters  — no FK dependencies
  2. events    — no FK dependencies
  3. fights    — depends on fighters + events UUIDs

Idempotency is handled by upsert on_conflict="ufcstats_id".
"""

from __future__ import annotations

import logging
from typing import Optional

from supabase import Client

from transform import ParsedFighter, ParsedEvent, ParsedFight

log = logging.getLogger(__name__)

_BATCH = 200
_PAGE = 1000


def _batched(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _fetch_all(db: Client, table: str, select: str) -> list[dict]:
    """Fetch all rows, handling Supabase's 1000-row default limit."""
    rows: list[dict] = []
    offset = 0
    while True:
        result = db.table(table).select(select).range(offset, offset + _PAGE - 1).execute()
        rows.extend(result.data)
        if len(result.data) < _PAGE:
            break
        offset += _PAGE
    return rows


# ---------------------------------------------------------------------------
# Fighters
# ---------------------------------------------------------------------------

def upsert_fighters(
    db: Client,
    fighters: list[ParsedFighter],
) -> dict[str, str]:
    """
    Upsert fighters and return {ufcstats_fighter_id: our_uuid}.
    Used downstream to resolve fighter IDs in fight rows.
    """
    rows = [
        {
            "ufcstats_id": f.ufcstats_id,
            "name": f.name,
            "date_of_birth": f.date_of_birth,
        }
        for f in fighters
        if f.ufcstats_id and f.name
    ]

    for batch in _batched(rows, _BATCH):
        db.table("fighters").upsert(batch, on_conflict="ufcstats_id").execute()

    log.info("Upserted %d fighters", len(rows))

    # Fetch back all rows to get DB-generated UUIDs keyed by UFCStats fighter ID
    rows = _fetch_all(db, "fighters", "id, ufcstats_id")
    return {row["ufcstats_id"]: row["id"] for row in rows if row["ufcstats_id"]}


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

def upsert_events(
    db: Client,
    events: list[ParsedEvent],
) -> dict[str, str]:
    """
    Upsert events and return {ufcstats_event_id: our_uuid}.
    """
    rows = [
        {
            "ufcstats_id": e.ufcstats_id,
            "name": e.name,
            "date": e.date,
            "location": e.location or None,
        }
        for e in events
        if e.ufcstats_id and e.name
    ]

    for batch in _batched(rows, _BATCH):
        db.table("events").upsert(batch, on_conflict="ufcstats_id").execute()

    log.info("Upserted %d events", len(rows))

    rows = _fetch_all(db, "events", "id, ufcstats_id")
    return {row["ufcstats_id"]: row["id"] for row in rows if row["ufcstats_id"]}


# ---------------------------------------------------------------------------
# Fights
# ---------------------------------------------------------------------------

def upsert_fights(
    db: Client,
    fights: list[ParsedFight],
    fighter_id_to_uuid: dict[str, str],
    event_id_to_uuid: dict[str, str],
) -> list[str]:
    """
    Upsert fights. fighter_id_to_uuid maps UFCStats fighter hex IDs → our UUIDs.
    """
    rows = []
    skipped = 0

    for fight in fights:
        fighter_a_id = fighter_id_to_uuid.get(fight.fighter_1_ufcstats_id)
        fighter_b_id = fighter_id_to_uuid.get(fight.fighter_2_ufcstats_id)
        event_uuid = event_id_to_uuid.get(fight.ufcstats_event_id)

        if not fighter_a_id or not fighter_b_id or not event_uuid:
            log.warning(
                "Skipping fight %s — could not resolve: "
                "fighter_1=%s (%s) fighter_2=%s (%s) event=%s (%s)",
                fight.ufcstats_id,
                fight.fighter_1_ufcstats_id, fighter_a_id,
                fight.fighter_2_ufcstats_id, fighter_b_id,
                fight.ufcstats_event_id, event_uuid,
            )
            skipped += 1
            continue

        winner_id: Optional[str] = None
        if fight.winner_ufcstats_id:
            winner_id = fighter_id_to_uuid.get(fight.winner_ufcstats_id)
            if not winner_id:
                log.warning(
                    "Fight %s: winner UFCStats ID %r not in fighter map — storing NULL",
                    fight.ufcstats_id, fight.winner_ufcstats_id,
                )

        rows.append({
            "ufcstats_id": fight.ufcstats_id,
            "event_id": event_uuid,
            "fighter_a_id": fighter_a_id,
            "fighter_b_id": fighter_b_id,
            "winner_id": winner_id,
            "method": fight.method,
            "round": fight.round,
            "time": fight.time,
            "weight_class": fight.weight_class,
            "is_title_fight": fight.is_title_fight,
        })

    inserted_ids: list[str] = []
    for batch in _batched(rows, _BATCH):
        result = (
            db.table("fights")
            .upsert(batch, on_conflict="ufcstats_id")
            .execute()
        )
        inserted_ids.extend(row["id"] for row in result.data)

    log.info("Upserted %d fights, skipped %d", len(rows), skipped)
    return inserted_ids


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def load(
    db: Client,
    fighters: list[ParsedFighter],
    events: list[ParsedEvent],
    fights: list[ParsedFight],
) -> list[str]:
    """
    Run the full upsert sequence. Returns fight UUIDs for the ELO calculation step.
    """
    fighter_id_to_uuid = upsert_fighters(db, fighters)
    event_id_to_uuid = upsert_events(db, events)
    fight_ids = upsert_fights(db, fights, fighter_id_to_uuid, event_id_to_uuid)
    return fight_ids
