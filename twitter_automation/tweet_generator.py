"""
tweet_generator.py
==================
Queries Supabase after a UFC event and generates draft tweet content.

Tweet types:
  leaderboard — Top 5 ELO per division  (uses active_elo view)
  movers      — Biggest ELO swings from the event, with finish method
  upset       — Biggest underdog win by pre-fight ELO gap
  snub_list   — Unranked fighters beating the ranked guys algorithmically
  p4p         — Pound-for-pound ELO leaderboard  (uses active_p4p view)

All content is written to tweet_drafts as 'pending'.
Nothing is posted here — approve_tweets.yml handles that.

Usage:
    python tweet_generator.py --event-id <uuid>
    python tweet_generator.py              # defaults to most recent event
"""

import argparse
import logging
import os
import sys
from typing import Optional

from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Divisions included in leaderboard tweets.
LEADERBOARD_DIVISIONS = [
    "Flyweight",
    "Bantamweight",
    "Featherweight",
    "Lightweight",
    "Welterweight",
    "Middleweight",
    "Light Heavyweight",
    "Heavyweight",
]

LEADERBOARD_TOP_N = 5
MIN_MOVER_DELTA = 15.0
TOP_MOVERS_N = 3
P4P_TOP_N = 10

# Division abbreviations for tweet body copy.
WC_SHORT = {
    "Strawweight": "STW",
    "Flyweight": "FLY",
    "Bantamweight": "BW",
    "Featherweight": "FW",
    "Lightweight": "LW",
    "Welterweight": "WW",
    "Middleweight": "MW",
    "Light Heavyweight": "LHW",
    "Heavyweight": "HW",
}

# Hashtags per division.
WC_TAG = {
    "Strawweight": "#Strawweight",
    "Flyweight": "#Flyweight",
    "Bantamweight": "#Bantamweight",
    "Featherweight": "#Featherweight",
    "Lightweight": "#Lightweight",
    "Welterweight": "#Welterweight",
    "Middleweight": "#Middleweight",
    "Light Heavyweight": "#LightHeavyweight",
    "Heavyweight": "#Heavyweight",
}


# ── Client ────────────────────────────────────────────────────────────────────

def get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _short_method(method: Optional[str]) -> str:
    if not method:
        return ""
    m = method.upper()
    if "KO" in m or "TKO" in m:
        return "KO/TKO"
    if "SUB" in m:
        return "Sub"
    if "SPLIT" in m:
        return "Split Dec"
    if "MAJORITY" in m:
        return "Maj Dec"
    if "DECISION" in m or "DEC" in m:
        return "Dec"
    return method


def _event_short(event_name: str) -> str:
    """'UFC Fight Night: Holloway vs Topuria' → 'UFC Fight Night'"""
    if ":" in event_name:
        return event_name.split(":")[0].strip()
    return event_name


def _safe_insert(supabase: Client, rows: list[dict]) -> None:
    if not rows:
        log.info("No rows to insert.")
        return
    resp = supabase.table("tweet_drafts").insert(rows).execute()
    log.info("Inserted %d tweet draft rows.", len(resp.data))


# ── Data queries ──────────────────────────────────────────────────────────────

def get_latest_event(supabase: Client) -> dict:
    from datetime import date
    today = date.today().isoformat()
    resp = (
        supabase.table("events")
        .select("id, name, date")
        .lte("date", today)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise ValueError("No events found.")
    return resp.data[0]


def get_event(supabase: Client, event_id: str) -> dict:
    resp = (
        supabase.table("events")
        .select("id, name, date")
        .eq("id", event_id)
        .single()
        .execute()
    )
    return resp.data


def get_division_leaderboard(supabase: Client, weight_class: str, top_n: int) -> list[dict]:
    """Top N active fighters in a division by current ELO via the active_elo view."""
    resp = (
        supabase.table("active_elo")
        .select("fighter_name, elo")
        .eq("weight_class", weight_class)
        .order("elo", desc=True)
        .limit(top_n)
        .execute()
    )
    return [
        {"rank": i + 1, "name": r["fighter_name"], "elo": float(r["elo"])}
        for i, r in enumerate(resp.data)
    ]


def get_p4p_leaderboard(supabase: Client, top_n: int) -> list[dict]:
    """Top N fighters by P4P ELO via the active_p4p view."""
    resp = (
        supabase.table("active_p4p")
        .select("fighter_name, elo")
        .order("elo", desc=True)
        .limit(top_n)
        .execute()
    )
    return [
        {"rank": i + 1, "name": r["fighter_name"], "elo": float(r["elo"])}
        for i, r in enumerate(resp.data)
    ]


def get_event_movers(supabase: Client, event_id: str) -> dict:
    """Biggest ELO gainers and losers from the event, including finish method."""
    fights_resp = (
        supabase.table("fights")
        .select("id, winner_id, method")
        .eq("event_id", event_id)
        .execute()
    )
    fight_ids = [f["id"] for f in fights_resp.data]
    fights_by_id = {f["id"]: f for f in fights_resp.data}

    if not fight_ids:
        return {"gainers": [], "losers": []}

    elo_resp = (
        supabase.table("elo_history")
        .select("fighter_id, fight_id, elo_before, elo_after, delta")
        .in_("fight_id", fight_ids)
        .execute()
    )

    fighter_ids = list({row["fighter_id"] for row in elo_resp.data})
    fighters_resp = (
        supabase.table("fighters")
        .select("id, name")
        .in_("id", fighter_ids)
        .execute()
    )
    fighters = {f["id"]: f["name"] for f in fighters_resp.data}

    movers = []
    for row in elo_resp.data:
        delta = float(row["delta"])
        if abs(delta) < MIN_MOVER_DELTA:
            continue
        fight = fights_by_id.get(row["fight_id"], {})
        movers.append({
            "name": fighters.get(row["fighter_id"], "Unknown"),
            "elo_after": float(row["elo_after"]),
            "delta": delta,
            "method": _short_method(fight.get("method")),
        })

    movers.sort(key=lambda x: x["delta"], reverse=True)
    gainers = [m for m in movers if m["delta"] > 0][:TOP_MOVERS_N]
    losers = sorted([m for m in movers if m["delta"] < 0], key=lambda x: x["delta"])[:TOP_MOVERS_N]
    return {"gainers": gainers, "losers": losers}


def get_biggest_upset(supabase: Client, event_id: str) -> Optional[dict]:
    """The biggest underdog win from the event measured by pre-fight ELO gap."""
    fights_resp = (
        supabase.table("fights")
        .select("id, winner_id, method")
        .eq("event_id", event_id)
        .not_.is_("winner_id", "null")
        .execute()
    )
    if not fights_resp.data:
        return None

    fight_ids = [f["id"] for f in fights_resp.data]
    fights_by_id = {f["id"]: f for f in fights_resp.data}

    elo_resp = (
        supabase.table("elo_history")
        .select("fighter_id, fight_id, elo_before, elo_after, delta")
        .in_("fight_id", fight_ids)
        .execute()
    )

    by_fight: dict[str, list] = {}
    for row in elo_resp.data:
        by_fight.setdefault(row["fight_id"], []).append(row)

    fighter_ids = list({row["fighter_id"] for row in elo_resp.data})
    fighters_resp = (
        supabase.table("fighters")
        .select("id, name")
        .in_("id", fighter_ids)
        .execute()
    )
    fighters = {f["id"]: f["name"] for f in fighters_resp.data}

    best: Optional[dict] = None
    for fid, rows in by_fight.items():
        fight = fights_by_id.get(fid)
        if not fight or len(rows) < 2:
            continue
        winner_row = next((r for r in rows if r["fighter_id"] == fight["winner_id"]), None)
        loser_row = next((r for r in rows if r["fighter_id"] != fight["winner_id"]), None)
        if not winner_row or not loser_row:
            continue
        # Upset = winner had lower ELO going in
        gap = float(loser_row["elo_before"]) - float(winner_row["elo_before"])
        if gap > 0 and (best is None or gap > best["elo_gap"]):
            best = {
                "winner": fighters.get(fight["winner_id"], "Unknown"),
                "loser": fighters.get(loser_row["fighter_id"], "Unknown"),
                "method": _short_method(fight.get("method")),
                "elo_gap": gap,
                "winner_delta": float(winner_row["delta"]),
                "winner_elo_after": float(winner_row["elo_after"]),
            }

    return best


def get_snub_list(supabase: Client) -> list[dict]:
    """Unranked active fighters with higher ELO than the lowest ranked fighter in their division."""
    active_resp = (
        supabase.table("active_elo")
        .select("fighter_id, fighter_name, weight_class, elo")
        .execute()
    )

    rankings_resp = (
        supabase.table("rankings")
        .select("fighter_id, weight_class")
        .is_("valid_to", "null")
        .execute()
    )
    ranked_by_wc: dict[str, set] = {}
    for r in rankings_resp.data:
        ranked_by_wc.setdefault(r["weight_class"], set()).add(r["fighter_id"])

    # Floor ELO = lowest ELO among currently ranked fighters per division.
    elo_floor: dict[str, float] = {}
    for row in active_resp.data:
        wc = row["weight_class"]
        fid = row["fighter_id"]
        if fid in ranked_by_wc.get(wc, set()):
            elo = float(row["elo"])
            if wc not in elo_floor or elo < elo_floor[wc]:
                elo_floor[wc] = elo

    snubs = []
    for row in active_resp.data:
        wc = row["weight_class"]
        fid = row["fighter_id"]
        if fid in ranked_by_wc.get(wc, set()):
            continue
        elo = float(row["elo"])
        floor = elo_floor.get(wc)
        if floor and elo > floor:
            snubs.append({
                "name": row["fighter_name"],
                "weight_class": wc,
                "elo": elo,
                "elo_gap": elo - floor,
            })

    snubs.sort(key=lambda x: x["elo_gap"], reverse=True)
    return snubs


# ── Tweet formatters ──────────────────────────────────────────────────────────

def format_leaderboard_tweets(event: dict, weight_class: str, fighters: list[dict]) -> list[str]:
    if not fighters:
        return []

    tag = WC_TAG.get(weight_class, f"#{weight_class.replace(' ', '')}")
    event_short = _event_short(event["name"])
    lines = [f"#{f['rank']}  {f['name']}  {f['elo']:.0f}" for f in fighters]

    header = f"{weight_class} ELO | {event_short}\n\n"
    footer = f"\nmma-elo.com  {tag} #UFC"
    body = "\n".join(lines)

    full = header + body + footer
    if len(full) <= 280:
        return [full]

    # Split into two tweets
    mid = len(lines) // 2 + 1
    root = header + "\n".join(lines[:mid])
    cont = "(cont.)\n" + "\n".join(lines[mid:]) + footer
    return [root, cont]


def format_movers_tweets(event: dict, movers: dict) -> list[str]:
    gainers = movers["gainers"]
    losers = movers["losers"]
    if not gainers and not losers:
        return []

    event_short = _event_short(event["name"])
    header = f"Biggest ELO swings | {event_short}\n\n"
    footer = "\n\nmma-elo.com  #UFC #MMA"

    def gain_line(m: dict) -> str:
        suffix = f"  ({m['method']})" if m["method"] else ""
        return f"📈  {m['name']}  +{m['delta']:.0f}{suffix}"

    def loss_line(m: dict) -> str:
        suffix = f"  ({m['method']})" if m["method"] else ""
        return f"📉  {m['name']}  {m['delta']:.0f}{suffix}"

    gain_lines = [gain_line(g) for g in gainers]
    loss_lines = [loss_line(m) for m in losers]

    body = "\n".join(gain_lines)
    if loss_lines:
        body += "\n\n" + "\n".join(loss_lines)

    full = header + body + footer
    if len(full) <= 280:
        return [full]

    root = header + "\n".join(gain_lines)
    cont = "\n".join(loss_lines) + footer
    return [root, cont]


def format_upset_tweet(event: dict, upset: dict) -> list[str]:
    event_short = _event_short(event["name"])
    gap = int(upset["elo_gap"])
    method = f" by {upset['method']}" if upset["method"] else ""

    tweet = (
        f"🚨 BIGGEST UPSET | {event_short}\n\n"
        f"{upset['winner']} beats {upset['loser']}{method}\n\n"
        f"The algorithm had {upset['loser']} {gap} ELO points ahead going in.\n\n"
        f"mma-elo.com  #UFC #MMA"
    )
    if len(tweet) <= 280:
        return [tweet]

    # Trim: drop site link
    tweet = (
        f"🚨 BIGGEST UPSET | {event_short}\n\n"
        f"{upset['winner']} beats {upset['loser']}{method}\n\n"
        f"Algorithm had {upset['loser']} {gap} pts ahead.  #UFC #MMA"
    )
    return [tweet[:280]]


def format_snub_list_tweets(event: dict, snubs: list[dict], max_snubs: int = 6) -> list[str]:
    if not snubs:
        return []

    top = snubs[:max_snubs]
    event_short = _event_short(event["name"])

    lines = [
        f"• {s['name']} [{WC_SHORT.get(s['weight_class'], s['weight_class'])}]  {s['elo']:.0f}"
        for s in top
    ]

    header = f"👀 Snub List | {event_short}\n\nUnranked. Higher ELO than someone on the official list.\n\n"
    footer = f"\nmma-elo.com  #UFC #MMA"
    body = "\n".join(lines)

    full = header + body + footer
    if len(full) <= 280:
        return [full]

    # Trim to 4 + overflow note
    body = "\n".join(lines[:4]) + f"\n+{len(top) - 4} more"
    full = header + body + footer
    if len(full) <= 280:
        return [full]

    return [(header + body)[:280]]


def format_p4p_tweets(event: dict, fighters: list[dict]) -> list[str]:
    if not fighters:
        return []

    event_short = _event_short(event["name"])
    header = f"P4P ELO | {event_short}\n\n"
    footer = "\n\nmma-elo.com  #UFC #MMA #P4P"
    lines = [f"#{f['rank']}  {f['name']}  {f['elo']:.0f}" for f in fighters]

    full = header + "\n".join(lines) + footer
    if len(full) <= 280:
        return [full]

    # Root: top 5. Reply: 6–10.
    root = header + "\n".join(lines[:5])
    cont = "(cont.)\n" + "\n".join(lines[5:]) + footer
    return [root, cont]


# ── Main orchestrator ─────────────────────────────────────────────────────────

def generate_and_store_drafts(event_id: Optional[str] = None, dry_run: bool = False) -> str:
    supabase = get_client()

    if event_id:
        event = get_event(supabase, event_id)
    else:
        event = get_latest_event(supabase)
        event_id = event["id"]

    log.info("Generating tweet drafts for: %s (%s)%s", event["name"], event["date"],
             "  [DRY RUN]" if dry_run else "")

    if not dry_run:
        existing = (
            supabase.table("tweet_drafts")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .execute()
        )
        if existing.count and existing.count > 0:
            log.warning("Drafts already exist for event %s (%d rows) — skipping.", event_id, existing.count)
            return event_id

    draft_rows: list[dict] = []

    def add_drafts(tweet_type: str, tweets: list[str], weight_class: Optional[str] = None) -> None:
        for i, text in enumerate(tweets):
            draft_rows.append({
                "event_id": event_id,
                "tweet_type": tweet_type,
                "weight_class": weight_class,
                "thread_index": i,
                "content": text,
                "status": "pending",
            })
        if tweets:
            log.info("  %s %s: %d tweet(s), max %d chars",
                     tweet_type, weight_class or "", len(tweets), max(len(t) for t in tweets))

    # ── Leaderboard per division ───────────────────────────────────────────────
    log.info("Generating leaderboard tweets...")
    for wc in LEADERBOARD_DIVISIONS:
        fighters = get_division_leaderboard(supabase, wc, LEADERBOARD_TOP_N)
        if fighters:
            add_drafts("leaderboard", format_leaderboard_tweets(event, wc, fighters), weight_class=wc)
        else:
            log.info("  No active_elo data for %s — skipping.", wc)

    # ── Biggest movers ─────────────────────────────────────────────────────────
    log.info("Generating movers tweet...")
    movers = get_event_movers(supabase, event_id)
    add_drafts("movers", format_movers_tweets(event, movers))

    # ── Biggest upset ──────────────────────────────────────────────────────────
    log.info("Generating upset tweet...")
    upset = get_biggest_upset(supabase, event_id)
    if upset:
        add_drafts("upset", format_upset_tweet(event, upset))
    else:
        log.info("  No clear underdog win found — skipping.")

    # ── Snub list ──────────────────────────────────────────────────────────────
    log.info("Generating snub list tweet...")
    snubs = get_snub_list(supabase)
    add_drafts("snub_list", format_snub_list_tweets(event, snubs))

    # ── P4P leaderboard ────────────────────────────────────────────────────────
    log.info("Generating P4P tweet...")
    p4p = get_p4p_leaderboard(supabase, P4P_TOP_N)
    add_drafts("p4p", format_p4p_tweets(event, p4p))

    # ── Print or insert ────────────────────────────────────────────────────────
    if dry_run:
        for row in draft_rows:
            label = f"[{row['tweet_type']} {row['weight_class'] or ''} #{row['thread_index']}]"
            print(f"\n{'─' * 60}")
            print(f"{label}  ({len(row['content'])}/280 chars)")
            print(row["content"])
        print(f"\n{'=' * 60}")
        print(f"DRY RUN: {len(draft_rows)} tweet(s) — nothing inserted.")
    else:
        _safe_insert(supabase, draft_rows)
        log.info("Done. %d draft rows for %s.", len(draft_rows), event["name"])

    return event_id


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate tweet drafts for a UFC event.")
    parser.add_argument("--event-id", default=None, help="Event UUID. Defaults to most recent.")
    parser.add_argument("--dry-run", action="store_true", help="Print tweets without inserting into DB.")
    args = parser.parse_args()

    try:
        eid = generate_and_store_drafts(args.event_id, dry_run=args.dry_run)
        if not args.dry_run:
            print(f"SUCCESS: Drafts generated for event {eid}")
        sys.exit(0)
    except Exception as e:
        log.exception("Failed: %s", e)
        sys.exit(1)
