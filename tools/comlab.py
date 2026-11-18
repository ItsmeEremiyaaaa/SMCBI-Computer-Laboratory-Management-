"""Shared helpers for the ComLab admin tools: settings, Supabase access, Manila time.

Settings come from tools/.env (never commit it):
    SUPABASE_URL=https://<project>.supabase.co
    SUPABASE_SERVICE_KEY=<service_role key from Supabase > Project Settings > API>
The service key bypasses row-level security, so keep it on the admin's PC only.
"""
from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

MANILA = timezone(timedelta(hours=8))
HERE = Path(__file__).resolve().parent
LAB_NAME = {"lab1": "ComLab 1", "lab2": "ComLab 2", "netlab": "NetLab"}


def load_env(path: Path = HERE / ".env") -> None:
    """Read KEY=VALUE lines into os.environ (existing variables win)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def client():
    """Supabase client with the service key (admin rights)."""
    load_env()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Copy tools/.env.example to tools/.env and fill it in.")
    from supabase import create_client  # imported here so tests don't need network libraries

    return create_client(url, key)


def fetch_all(sb, table: str, **eq) -> list[dict]:
    """All rows of a table (paged, Supabase returns at most 1000 per request)."""
    rows: list[dict] = []
    while True:
        q = sb.table(table).select("*")
        for k, v in eq.items():
            q = q.eq(k, v)
        batch = q.range(len(rows), len(rows) + 999).execute().data
        rows += batch
        if len(batch) < 1000:
            return rows


def hm(t: str) -> time:
    """'13:00' or '13:00:00' → time(13, 0)."""
    h, m = t.split(":")[:2]
    return time(int(h), int(m))


def to_manila(ts: str) -> datetime:
    """ISO timestamp from Postgres → aware datetime in Manila time."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(MANILA)


def today_manila() -> date:
    return datetime.now(MANILA).date()


def class_days(schedule: dict, start: date, end: date) -> list[date]:
    """Dates between start and end (inclusive) on which a weekly class meets."""
    first = max(start, date.fromisoformat(schedule["starts_on"]))
    last = min(end, date.fromisoformat(schedule["ends_on"]))
    out, d = [], first
    while d <= last:
        if d.isoweekday() == schedule["day_of_week"]:
            out.append(d)
        d += timedelta(days=1)
    return out


def section_of(student: dict) -> str:
    """Student record → timetable section name, e.g. BSIT + '1st Year' + 'A' → 'BSIT 1A'."""
    return f"{student['course']} {student['year_level'][0]}{student['section']}".upper()


def out_dir() -> Path:
    d = HERE / "out"
    d.mkdir(exist_ok=True)
    return d


def in_section(student: dict, section: str) -> bool:
    """'BSIT 1A' matches only section A; 'BSIT 4' (no letter) matches every 4th-year section."""
    sec, mine = section.upper().replace("  ", " ").strip(), section_of(student)
    return mine == sec or (sec[-1:].isdigit() and mine[:-1] == sec)
