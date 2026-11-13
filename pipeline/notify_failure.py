"""
Emails an alert when the weekly pipeline workflow fails.

Called from the `alert_on_failure` job in .github/workflows/ufc_event_pipeline.yml.
Uses the same Gmail SMTP secrets as twitter_automation/review_notifier.py.
Standard library only, so the job needs no pip install.
"""

import os
import smtplib
from email.mime.text import MIMEText

run_url = (
    f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
    f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
)
failed = os.environ.get("FAILED_JOBS", "unknown")

body = f"""The UFC ELO weekly pipeline failed, so the website will not have this week's results.

Failed job(s): {failed}
Run log: {run_url}

Common causes:
  - "STALE DATA" — no new events for 21+ days. Check whether Greco1899/scrape_ufc_stats
    is still updating: https://github.com/Greco1899/scrape_ufc_stats/commits/main
  - "Could not resolve fighters" — a fighter name matched zero or several fighters.
    Add it to pipeline/data/greco_name_overrides.json and re-run the workflow.
"""

msg = MIMEText(body)
msg["Subject"] = "[UFC ELO] Weekly pipeline FAILED"
msg["From"] = os.environ["NOTIFY_EMAIL_FROM"]
msg["To"] = os.environ["NOTIFY_EMAIL_TO"]

with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
    server.login(os.environ["NOTIFY_EMAIL_FROM"], os.environ["NOTIFY_EMAIL_PASSWORD"])
    server.sendmail(msg["From"], [msg["To"]], msg.as_string())

print(f"Failure alert sent ({failed})")
