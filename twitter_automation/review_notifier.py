"""
review_notifier.py
==================
Fetches pending tweet drafts from Supabase and sends a review email
summarising the content, including char counts and a direct link to
trigger the approve_tweets GitHub Actions workflow.

Transport: Gmail via SMTP with an App Password (no third-party service needed).
Swap out the send_email() function if you prefer SendGrid, Postmark, etc.

Usage:
    python review_notifier.py --event-id <uuid>

Environment variables required:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
    NOTIFY_EMAIL_TO       — your personal email address
    NOTIFY_EMAIL_FROM     — Gmail address to send from (e.g. yourapp@gmail.com)
    NOTIFY_EMAIL_PASSWORD — Gmail App Password (not your login password)
    GITHUB_REPO           — e.g. yourusername/mma-elo-ratings
    GITHUB_TOKEN          — fine-grained PAT with 'Actions: write' scope
"""

import argparse
import logging
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests
from supabase import create_client, Client

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

EMAIL_TO = os.environ["NOTIFY_EMAIL_TO"]
EMAIL_FROM = os.environ["NOTIFY_EMAIL_FROM"]
EMAIL_PASSWORD = os.environ["NOTIFY_EMAIL_PASSWORD"]

GITHUB_REPO = os.environ["GITHUB_REPO"]       # e.g. "yourname/mma-elo"
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]


# ── Supabase ──────────────────────────────────────────────────────────────────

def get_pending_drafts(event_id: str) -> list[dict]:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    resp = (
        supabase.table("tweet_drafts")
        .select("id, tweet_type, weight_class, thread_index, content, char_count")
        .eq("event_id", event_id)
        .eq("status", "pending")
        .order("tweet_type")
        .order("weight_class")
        .order("thread_index")
        .execute()
    )
    return resp.data


def get_event_name(event_id: str) -> str:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    resp = supabase.table("events").select("name, date").eq("id", event_id).single().execute()
    if resp.data:
        return f"{resp.data['name']} ({resp.data['date']})"
    return event_id


# ── GitHub Actions trigger ────────────────────────────────────────────────────

def build_approve_url(event_id: str) -> str:
    """
    Returns the URL for the GitHub Actions workflow_dispatch endpoint that will
    post the approved tweets. Clicking this (with auth) triggers posting.

    We embed the event_id as a workflow input so the poster job knows which
    event's drafts to post.
    """
    # This is the API endpoint — we'll embed it as a pre-filled form link in the email.
    # The actual call requires a POST with a token, so we generate a helper curl command
    # and a link to the Actions UI.
    repo = GITHUB_REPO
    workflow_file = "approve_tweets.yml"
    actions_url = f"https://github.com/{repo}/actions/workflows/{workflow_file}"
    return actions_url


def trigger_post_workflow(event_id: str) -> bool:
    """
    Programmatically trigger the approve_tweets workflow via the GitHub API.
    Call this from the email approval link handler (if you build a tiny webhook),
    or just trigger manually from the GitHub Actions UI.
    """
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/approve_tweets.yml/dispatches"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {
        "ref": "main",  # branch to run on
        "inputs": {
            "event_id": event_id,
        },
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    if resp.status_code == 204:
        log.info("Successfully triggered approve_tweets workflow for event %s", event_id)
        return True
    log.error("Failed to trigger workflow: %s — %s", resp.status_code, resp.text)
    return False


# ── Email builder ─────────────────────────────────────────────────────────────

def build_email_html(event_name: str, event_id: str, drafts: list[dict]) -> str:
    """
    Builds a readable HTML email with tweet previews grouped by type.
    Includes char-count warnings and a link to the Actions UI.
    """
    actions_url = build_approve_url(event_id)

    # Group drafts by type
    groups: dict[str, list[dict]] = {}
    for d in drafts:
        key = d["tweet_type"]
        groups.setdefault(key, []).append(d)

    tweet_blocks = ""
    type_labels = {
        "leaderboard": "🏆 Leaderboard Tweets",
        "movers": "⚡ Biggest Movers",
        "upset": "🚨 Biggest Upset",
        "snub_list": "👀 Snub List",
        "p4p": "🥊 P4P Rankings",
    }

    for tweet_type, rows in groups.items():
        label = type_labels.get(tweet_type, tweet_type)

        # Sub-group by weight class for leaderboard
        subgroups: dict[str, list[dict]] = {}
        for r in rows:
            sub = r.get("weight_class") or "Cross-division"
            subgroups.setdefault(sub, []).append(r)

        tweet_blocks += f"<h2 style='color:#1da1f2;border-bottom:2px solid #1da1f2;padding-bottom:4px'>{label}</h2>"

        for subkey, sub_rows in subgroups.items():
            if len(subgroups) > 1:
                tweet_blocks += f"<h3 style='color:#555;margin-top:16px'>{subkey}</h3>"

            for row in sub_rows:
                chars = row["char_count"]
                over = chars > 280
                char_badge = (
                    f"<span style='background:#e0245e;color:white;padding:2px 6px;border-radius:3px;font-size:12px'>⚠ {chars}/280</span>"
                    if over
                    else f"<span style='background:#17bf63;color:white;padding:2px 6px;border-radius:3px;font-size:12px'>{chars}/280</span>"
                )

                thread_label = ""
                if row["thread_index"] > 0:
                    thread_label = f"<em style='color:#888;font-size:12px'>↩ Reply {row['thread_index']}</em><br>"

                content_html = row["content"].replace("\n", "<br>").replace(" ", "&nbsp;")
                tweet_blocks += f"""
                <div style='background:#f5f8fa;border:1px solid #e1e8ed;border-radius:8px;
                            padding:12px 16px;margin:8px 0;font-family:monospace;font-size:14px;
                            line-height:1.6'>
                    {thread_label}
                    {content_html}
                    <div style='margin-top:8px'>{char_badge}</div>
                </div>
                """

    approve_button = f"""
    <div style='margin:32px 0;text-align:center'>
        <a href='{actions_url}'
           style='background:#1da1f2;color:white;padding:14px 28px;border-radius:6px;
                  text-decoration:none;font-size:16px;font-weight:bold;display:inline-block'>
            ✅ Approve &amp; Post Tweets
        </a>
        <p style='color:#888;font-size:12px;margin-top:8px'>
            Opens GitHub Actions → Run workflow → enter event ID: <code>{event_id}</code>
        </p>
    </div>
    """

    total = len(drafts)
    over_limit = sum(1 for d in drafts if d["char_count"] > 280)
    warning = ""
    if over_limit:
        warning = f"""
        <div style='background:#fff8e1;border:1px solid #ffc107;border-radius:6px;
                    padding:12px;margin:16px 0;color:#856404'>
            ⚠️ <strong>{over_limit} tweet(s) exceed 280 characters</strong> —
            review and edit before approving.
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <body style='font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#14171a'>
        <div style='background:#1da1f2;color:white;padding:16px 20px;border-radius:8px;margin-bottom:24px'>
            <h1 style='margin:0;font-size:20px'>🥊 UFC ELO — Tweet Review</h1>
            <p style='margin:4px 0 0;opacity:0.9'>{event_name}</p>
        </div>

        <p style='color:#555'>{total} tweet drafts ready for review.</p>
        {warning}
        {approve_button}
        <hr style='border:none;border-top:1px solid #e1e8ed;margin:24px 0'>
        {tweet_blocks}
        {approve_button}
        <hr style='border:none;border-top:1px solid #e1e8ed;margin:24px 0'>
        <p style='color:#888;font-size:12px'>
            Event ID: <code>{event_id}</code><br>
            Generated by UFC ELO Ratings pipeline
        </p>
    </body>
    </html>
    """


def build_email_text(event_name: str, event_id: str, drafts: list[dict]) -> str:
    """Plain-text fallback for email clients that don't render HTML."""
    lines = [
        f"UFC ELO — Tweet Review: {event_name}",
        f"Event ID: {event_id}",
        f"{len(drafts)} draft(s) pending review.",
        "",
        "=" * 60,
    ]
    current_type = None
    for d in drafts:
        if d["tweet_type"] != current_type:
            current_type = d["tweet_type"]
            lines += ["", f"── {current_type.upper()} ──", ""]
        if d["thread_index"] > 0:
            lines.append(f"[Reply {d['thread_index']}]")
        lines.append(d["content"])
        lines.append(f"({d['char_count']}/280 chars)")
        lines.append("")
    lines += [
        "=" * 60,
        "",
        "To post these tweets:",
        f"1. Go to: https://github.com/{GITHUB_REPO}/actions/workflows/approve_tweets.yml",
        "2. Click 'Run workflow'",
        f"3. Enter event_id: {event_id}",
        "4. Click 'Run workflow'",
    ]
    return "\n".join(lines)


# ── Email sender ──────────────────────────────────────────────────────────────

def send_email(subject: str, html_body: str, text_body: str) -> None:
    """Send via Gmail SMTP with an App Password."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = EMAIL_TO

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())

    log.info("Review email sent to %s", EMAIL_TO)


# ── Main ──────────────────────────────────────────────────────────────────────

def send_review_notification(event_id: str) -> None:
    event_name = get_event_name(event_id)
    drafts = get_pending_drafts(event_id)

    if not drafts:
        log.warning("No pending drafts found for event %s — skipping notification.", event_id)
        return

    over_limit = sum(1 for d in drafts if d["char_count"] > 280)
    subject = (
        f"⚠️ UFC ELO Tweets Ready ({over_limit} over limit) — {event_name}"
        if over_limit
        else f"✅ UFC ELO Tweets Ready for Review — {event_name}"
    )

    html = build_email_html(event_name, event_id, drafts)
    text = build_email_text(event_name, event_id, drafts)
    send_email(subject, html, text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True, help="UUID of the event to review.")
    args = parser.parse_args()

    try:
        send_review_notification(args.event_id)
        sys.exit(0)
    except Exception as e:
        log.exception("Failed to send review notification: %s", e)
        sys.exit(1)
