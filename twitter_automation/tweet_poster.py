"""
tweet_poster.py
===============
Reads approved (or pending, with --auto-approve flag) tweet drafts from
Supabase and posts them to Twitter via Tweepy (Twitter API v2).

Threads are handled automatically: if a tweet_type has multiple rows
(thread_index 0, 1, 2...) they are posted sequentially, each as a reply
to the previous, forming a proper thread.

The posted twitter_id and timestamp are written back to tweet_drafts
so you have a complete audit trail.

Usage:
    # Post all 'pending' drafts for an event (auto-approve mode — use carefully)
    python tweet_poster.py --event-id <uuid> --auto-approve

    # Post only 'approved' drafts (recommended — requires manual approval step)
    python tweet_poster.py --event-id <uuid>

    # Dry run — print what would be posted without actually tweeting
    python tweet_poster.py --event-id <uuid> --dry-run

Environment variables required:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
    TWITTER_API_KEY           — OAuth 1.0a consumer key
    TWITTER_API_SECRET        — OAuth 1.0a consumer secret
    TWITTER_ACCESS_TOKEN      — OAuth 1.0a access token
    TWITTER_ACCESS_TOKEN_SECRET
    (All four are from your Twitter Developer App settings)
"""

import argparse
import logging
import os
import sys
import time
from typing import Optional

import tweepy
from supabase import create_client, Client

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

TWITTER_API_KEY = os.environ["TWITTER_API_KEY"]
TWITTER_API_SECRET = os.environ["TWITTER_API_SECRET"]
TWITTER_ACCESS_TOKEN = os.environ["TWITTER_ACCESS_TOKEN"]
TWITTER_ACCESS_TOKEN_SECRET = os.environ["TWITTER_ACCESS_TOKEN_SECRET"]

# Delay between individual tweets (Twitter rate limit: 300 writes per 15 min).
# 5 seconds is conservative and avoids triggering spam detection on thread bursts.
INTER_TWEET_DELAY_SECONDS = 5

# Delay between posting different tweet groups (leaderboard per division, movers, snubs).
INTER_GROUP_DELAY_SECONDS = 30


# ── Twitter client ────────────────────────────────────────────────────────────

def get_twitter_client() -> tweepy.Client:
    """
    Returns a Tweepy v4 Client using OAuth 1.0a (required for posting tweets).
    Twitter API v2 free tier allows 1,500 tweets/month — plenty for this use case.
    """
    return tweepy.Client(
        consumer_key=TWITTER_API_KEY,
        consumer_secret=TWITTER_API_SECRET,
        access_token=TWITTER_ACCESS_TOKEN,
        access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
    )


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_drafts_to_post(event_id: str, auto_approve: bool) -> list[dict]:
    """
    Returns tweet drafts ready to post, ordered for correct thread assembly.
    """
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    statuses = ["pending", "approved"] if auto_approve else ["approved"]

    resp = (
        supabase.table("tweet_drafts")
        .select("id, tweet_type, weight_class, thread_index, content, char_count, status")
        .eq("event_id", event_id)
        .in_("status", statuses)
        .order("tweet_type")
        .order("weight_class", nullsfirst=False)
        .order("thread_index")
        .execute()
    )
    return resp.data


def mark_as_posted(draft_id: str, twitter_id: str) -> None:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    from datetime import datetime, timezone

    supabase.table("tweet_drafts").update(
        {
            "status": "posted",
            "twitter_id": twitter_id,
            "posted_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", draft_id).execute()


def mark_as_failed(draft_id: str, reason: str) -> None:
    """Mark a draft as skipped/failed so it doesn't block subsequent runs."""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    supabase.table("tweet_drafts").update(
        {"status": "skipped"}
    ).eq("id", draft_id).execute()
    log.error("Draft %s marked as skipped: %s", draft_id, reason)


# ── Posting logic ─────────────────────────────────────────────────────────────

def group_into_threads(drafts: list[dict]) -> list[list[dict]]:
    """
    Groups drafts by (tweet_type, weight_class) and sorts by thread_index,
    returning a list of 'thread groups' where each group is a list of
    sequential tweets (index 0 = root, 1+ = replies).
    """
    groups: dict[tuple, list[dict]] = {}
    for d in drafts:
        key = (d["tweet_type"], d.get("weight_class") or "")
        groups.setdefault(key, []).append(d)

    # Sort each group by thread_index, then sort groups into a sensible order
    # (leaderboard first, then movers, then snubs)
    type_order = {"leaderboard": 0, "movers": 1, "upset": 2, "snub_list": 3, "p4p": 4}
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (type_order.get(k[0], 99), k[1]),
    )
    return [sorted(groups[k], key=lambda d: d["thread_index"]) for k in sorted_keys]


def validate_tweet(draft: dict) -> Optional[str]:
    """
    Returns an error string if the tweet is invalid, None if it's fine.
    """
    content = draft["content"].strip()
    if not content:
        return "Empty content"
    if len(content) > 280:
        return f"Too long: {len(content)} chars (max 280)"
    return None


def post_thread(
    client: tweepy.Client,
    thread: list[dict],
    dry_run: bool = False,
) -> None:
    """
    Posts a list of drafts as a thread.
    The first tweet is the root; subsequent ones reply to the previous.
    """
    reply_to_id: Optional[str] = None

    for i, draft in enumerate(thread):
        err = validate_tweet(draft)
        if err:
            log.error("Skipping draft %s: %s", draft["id"], err)
            mark_as_failed(draft["id"], err)
            continue

        content = draft["content"].strip()
        label = f"[{draft['tweet_type']} {draft.get('weight_class', '')} thread_index={draft['thread_index']}]"

        if dry_run:
            print(f"\n{'─' * 60}")
            print(f"DRY RUN {label}")
            print(f"reply_to: {reply_to_id or 'root'}")
            print(content)
            print(f"({len(content)}/280 chars)")
            # Simulate a tweet ID for thread chaining in dry-run
            reply_to_id = f"dry-run-{draft['id'][:8]}"
            continue

        try:
            kwargs = {"text": content}
            if reply_to_id:
                kwargs["in_reply_to_tweet_id"] = reply_to_id

            response = client.create_tweet(**kwargs)
            twitter_id = str(response.data["id"])
            log.info("Posted %s → twitter_id=%s", label, twitter_id)
            mark_as_posted(draft["id"], twitter_id)
            reply_to_id = twitter_id

            if i < len(thread) - 1:
                time.sleep(INTER_TWEET_DELAY_SECONDS)

        except tweepy.TweepyException as e:
            log.error("Tweepy error posting %s: %s", label, e)
            mark_as_failed(draft["id"], str(e))
            # Don't raise — continue with next thread group
            break


def post_all_drafts(event_id: str, dry_run: bool = False, auto_approve: bool = False) -> None:
    """Main posting orchestrator."""
    drafts = get_drafts_to_post(event_id, auto_approve)

    if not drafts:
        log.warning(
            "No drafts with status 'approved'%s found for event %s.",
            " or 'pending'" if auto_approve else "",
            event_id,
        )
        return

    log.info("Found %d draft(s) to post for event %s.", len(drafts), event_id)

    # Validate all tweets upfront before posting anything
    errors = []
    for d in drafts:
        err = validate_tweet(d)
        if err:
            errors.append(f"  Draft {d['id']}: {err}")
    if errors:
        log.warning("Pre-flight validation warnings:\n%s", "\n".join(errors))

    client = get_twitter_client() if not dry_run else None
    thread_groups = group_into_threads(drafts)

    log.info("Posting %d thread group(s)...", len(thread_groups))

    for gi, thread in enumerate(thread_groups):
        log.info(
            "  Group %d/%d: %s %s (%d tweet(s))",
            gi + 1,
            len(thread_groups),
            thread[0]["tweet_type"],
            thread[0].get("weight_class") or "",
            len(thread),
        )
        post_thread(client, thread, dry_run=dry_run)

        # Pause between groups to avoid looking like a spam burst
        if gi < len(thread_groups) - 1 and not dry_run:
            log.info("  Waiting %ds before next group...", INTER_GROUP_DELAY_SECONDS)
            time.sleep(INTER_GROUP_DELAY_SECONDS)

    if dry_run:
        print(f"\n{'=' * 60}")
        print(f"DRY RUN complete. {len(drafts)} tweet(s) would have been posted.")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Post approved tweet drafts to Twitter.")
    parser.add_argument("--event-id", required=True, help="Event UUID to post drafts for.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print tweets without actually posting them.",
    )
    parser.add_argument(
        "--auto-approve",
        action="store_true",
        help="Post 'pending' drafts without requiring manual approval. Use carefully.",
    )
    args = parser.parse_args()

    try:
        post_all_drafts(args.event_id, dry_run=args.dry_run, auto_approve=args.auto_approve)
        sys.exit(0)
    except Exception as e:
        log.exception("Failed to post tweets: %s", e)
        sys.exit(1)
