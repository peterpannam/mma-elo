"""
ELO calculation engine — adapted from github.com/NBAtrev/UFC-Elo-Engine

Key differences from the original:
- ELO is division-specific: keyed by (fighter_id, weight_class), not fighter name
- New fighter in a division always starts at INITIAL_ELO (1500), regardless of
  record in other divisions
- Reads fights from Supabase (ordered by event date) instead of CSV
- Writes to elo_history (append-only) instead of CSV export
- Idempotent: skips fights that already have elo_history rows
"""

from __future__ import annotations

import logging
from typing import Optional

from supabase import Client

log = logging.getLogger(__name__)

INITIAL_ELO: float = 1500.0
BASE_K: float = 40.0

# ---------------------------------------------------------------------------
# Pure ELO math (unchanged from original)
# ---------------------------------------------------------------------------

def _expected(elo_a: float, elo_b: float) -> float:
    return 1 / (1 + 10 ** ((elo_b - elo_a) / 400))


def _k_factor(method: Optional[str]) -> float:
    m = (method or "").upper()
    if "KO" in m or "SUB" in m:
        return BASE_K * 1.15
    return BASE_K


def _update_elo(
    elo_a: float,
    elo_b: float,
    k: float,
    result: str,  # "win_a" | "win_b" | "draw" | "nc"
) -> tuple[float, float]:
    """Return (new_elo_a, new_elo_b). NC returns unchanged values."""
    if result == "nc":
        return elo_a, elo_b

    exp_a = _expected(elo_a, elo_b)
    exp_b = 1 - exp_a

    if result == "win_a":
        score_a, score_b = 1.0, 0.0
    elif result == "win_b":
        score_a, score_b = 0.0, 1.0
    else:  # draw
        score_a, score_b = 0.5, 0.5

    new_a = round(elo_a + k * (score_a - exp_a), 2)
    new_b = round(elo_b + k * (score_b - exp_b), 2)
    return new_a, new_b


def _classify_result(
    winner_id: Optional[str],
    fighter_a_id: str,
    fighter_b_id: str,
    method: Optional[str],
) -> str:
    if winner_id == fighter_a_id:
        return "win_a"
    if winner_id == fighter_b_id:
        return "win_b"
    # winner_id is NULL — draw or NC
    m = (method or "").lower()
    if "no contest" in m or m.strip() == "nc":
        return "nc"
    return "draw"


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _fetch_all(db: Client, table: str, select: str, order: Optional[str] = None) -> list[dict]:
    """Fetch all rows from a table, handling Supabase's 1000-row default limit."""
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        q = db.table(table).select(select).range(offset, offset + page_size - 1)
        if order:
            q = q.order(order)
        result = q.execute()
        rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return rows


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def calculate(db: Client) -> int:
    """
    Process all fights that don't yet have elo_history rows and INSERT them.
    Safe to call repeatedly — already-processed fights are skipped.
    Returns the number of fights processed.
    """
    # --- Load fights with event dates (need date for chronological order) ---
    fights = _fetch_all(
        db, "fights",
        "id, fighter_a_id, fighter_b_id, winner_id, method, weight_class, events(date)",
        order="events(date)",
    )
    # Flatten nested event date
    for f in fights:
        f["event_date"] = (f.get("events") or {}).get("date") or ""
    fights.sort(key=lambda f: f["event_date"])

    # --- Find fights already in elo_history ---
    existing = _fetch_all(db, "elo_history", "fight_id")
    done_fight_ids: set[str] = {row["fight_id"] for row in existing}

    # --- Build current ELO state from existing history ---
    # Sorted by date (append-only), so last row per key is most recent
    history = _fetch_all(
        db, "elo_history",
        "fighter_id, weight_class, elo_after, p4p_elo_after, date",
        order="date",
    )
    elo_state: dict[tuple[str, str], float] = {}
    p4p_state: dict[str, float] = {}
    for row in history:
        elo_state[(row["fighter_id"], row["weight_class"])] = row["elo_after"]
        if row.get("p4p_elo_after") is not None:
            p4p_state[row["fighter_id"]] = row["p4p_elo_after"]

    # --- Process unprocessed fights ---
    batch: list[dict] = []
    processed = 0

    for fight in fights:
        fid = fight["id"]
        if fid in done_fight_ids:
            continue

        wc = fight["weight_class"]
        a_id = fight["fighter_a_id"]
        b_id = fight["fighter_b_id"]
        date = fight["event_date"]
        method = fight.get("method")

        elo_a = elo_state.get((a_id, wc), INITIAL_ELO)
        elo_b = elo_state.get((b_id, wc), INITIAL_ELO)
        p4p_a = p4p_state.get(a_id, INITIAL_ELO)
        p4p_b = p4p_state.get(b_id, INITIAL_ELO)

        result = _classify_result(fight.get("winner_id"), a_id, b_id, method)
        k = _k_factor(method)
        new_a,     new_b     = _update_elo(elo_a, elo_b, k, result)
        new_p4p_a, new_p4p_b = _update_elo(p4p_a, p4p_b, k, result)

        batch.append({
            "fighter_id":     a_id,
            "fight_id":       fid,
            "weight_class":   wc,
            "elo_before":     elo_a,
            "elo_after":      new_a,
            "delta":          round(new_a - elo_a, 2),
            "date":           date,
            "p4p_elo_before": p4p_a,
            "p4p_elo_after":  new_p4p_a,
            "p4p_delta":      round(new_p4p_a - p4p_a, 2),
        })
        batch.append({
            "fighter_id":     b_id,
            "fight_id":       fid,
            "weight_class":   wc,
            "elo_before":     elo_b,
            "elo_after":      new_b,
            "delta":          round(new_b - elo_b, 2),
            "date":           date,
            "p4p_elo_before": p4p_b,
            "p4p_elo_after":  new_p4p_b,
            "p4p_delta":      round(new_p4p_b - p4p_b, 2),
        })

        elo_state[(a_id, wc)] = new_a
        elo_state[(b_id, wc)] = new_b
        p4p_state[a_id] = new_p4p_a
        p4p_state[b_id] = new_p4p_b
        processed += 1

        # Flush in batches of 200 pairs (400 rows)
        if len(batch) >= 400:
            db.table("elo_history").insert(batch).execute()
            batch = []

    if batch:
        db.table("elo_history").insert(batch).execute()

    log.info("ELO calculated for %d fights", processed)
    return processed
