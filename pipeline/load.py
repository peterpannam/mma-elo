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

# Supabase upsert batch size — keeps request payloads manageable
_BATCH = 200


def _batched(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


# ---------------------------------------------------------------------------
# Fighters
# ---------------------------------------------------------------------------

def upsert_fighters(
    db: Client,
    fighters: list[ParsedFighter],
) -> dict[str, str]:
    """
    Upsert fighters and return {fighter_name: our_uuid}.
    Used downstream to resolve fighter names in fight rows.
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

    # Fetch back to get DB-generated UUIDs
    result = db.table("fighters").select("id, name, ufcstats_id").execute()
    return {row["name"]: row["id"] for row in result.data}


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

    result = db.table("events").select("id, ufcstats_id").execute()
    return {row["ufcstats_id"]: row["id"] for row in result.data}


# ---------------------------------------------------------------------------
# Fights
# ---------------------------------------------------------------------------

def upsert_fights(
    db: Client,
    fights: list[ParsedFight],
    name_to_uuid: dict[str, str],
    event_id_to_uuid: dict[str, str],
) -> list[str]:
    """
    Upsert fights and return list of newly inserted fight UUIDs (for ELO step).

    Fights where fighter UUIDs or event UUID cannot be resolved are skipped
    with a warning — this can happen if a fighter profile page hasn't been
    scraped yet (rare but possible on first run).
    """
    rows = []
    skipped = 0

    for fight in fights:
        fighter_a_id = name_to_uuid.get(fight.fighter_1_name)
        fighter_b_id = name_to_uuid.get(fight.fighter_2_name)
        event_uuid = event_id_to_uuid.get(fight.ufcstats_event_id)

        if not fighter_a_id or not fighter_b_id or not event_uuid:
            log.warning(
                "Skipping fight %s — could not resolve: fighter_1=%s (%s) "
                "fighter_2=%s (%s) event=%s (%s)",
                fight.ufcstats_id,
                fight.fighter_1_name, fighter_a_id,
                fight.fighter_2_name, fighter_b_id,
                fight.ufcstats_event_id, event_uuid,
            )
            skipped += 1
            continue

        winner_id: Optional[str] = None
        if fight.winner_name:
            winner_id = name_to_uuid.get(fight.winner_name)
            if not winner_id:
                log.warning(
                    "Fight %s: winner name %r not in fighter map — storing NULL",
                    fight.ufcstats_id, fight.winner_name,
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
    name_to_uuid = upsert_fighters(db, fighters)
    event_id_to_uuid = upsert_events(db, events)
    fight_ids = upsert_fights(db, fights, name_to_uuid, event_id_to_uuid)
    return fight_ids
