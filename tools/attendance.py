"""Attendance per class session from QR check-ins → Excel (one sheet per section).

    python attendance.py 2026-11-01 2026-11-30            # all sections
    python attendance.py 2026-11-01 2026-11-30 --section "BSIT 1A"

A student counts as present when they checked in to a PC in the class's lab between
10 minutes before the start and the end of that session (same rule as the website).
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta

import pandas as pd

from comlab import MANILA, LAB_NAME, class_days, client, fetch_all, hm, in_section, out_dir, to_manila

EARLY = timedelta(minutes=10)


def attendance(schedules: list[dict], students: list[dict], profiles: list[dict], checkins: list[dict],
               start: date, end: date, only_section: str | None = None) -> pd.DataFrame:
    """One row per (session, enrolled student) with Present/Absent and the check-in time."""
    user_email = {p["id"]: p["email"].lower() for p in profiles}
    # check-ins by email, so they line up with student records
    by_email: dict[str, list[dict]] = {}
    for c in checkins:
        email = user_email.get(c["user_id"])
        if email:
            by_email.setdefault(email, []).append(c)

    rows = []
    for s in schedules:
        sec = s["section"].upper()
        if only_section and sec != only_section.upper():
            continue
        enrolled = [st for st in students if in_section(st, sec) and st.get("status", "Enrolled") == "Enrolled"]
        for day in class_days(s, start, end):
            t0 = datetime.combine(day, hm(s["start_time"]), MANILA)
            t1 = datetime.combine(day, hm(s["end_time"]), MANILA)
            for st in sorted(enrolled, key=lambda x: x["student_id"]):
                hit = next((c for c in by_email.get(st["email"].lower(), [])
                            if c["lab_id"] == s["lab_id"] and t0 - EARLY <= to_manila(c["checked_in_at"]) < t1), None)
                rows.append({
                    "Section": s["section"], "Subject": s["subject"], "Date": day.isoformat(),
                    "Time": f"{s['start_time'][:5]}-{s['end_time'][:5]}", "Lab": LAB_NAME.get(s["lab_id"], s["lab_id"]),
                    "Student ID": st["student_id"], "Name": st["full_name"],
                    "Status": "Present" if hit else "Absent",
                    "Checked in": to_manila(hit["checked_in_at"]).strftime("%H:%M") if hit else "",
                    "PC": hit["pc_id"].split("-")[-1].upper() if hit else "",
                })
    return pd.DataFrame(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("start", type=date.fromisoformat)
    ap.add_argument("end", type=date.fromisoformat)
    ap.add_argument("--section", help='e.g. "BSIT 1A"')
    a = ap.parse_args()

    sb = client()
    df = attendance(fetch_all(sb, "class_schedules"), fetch_all(sb, "students"), fetch_all(sb, "profiles"),
                    fetch_all(sb, "checkins"), a.start, a.end, a.section)
    if df.empty:
        raise SystemExit("No class sessions with enrolled students in that range.")
    path = out_dir() / f"attendance_{a.start}_{a.end}.xlsx"
    with pd.ExcelWriter(path) as xl:
        summary = (df.assign(Present=df["Status"].eq("Present"))
                     .groupby(["Section", "Subject", "Date"], as_index=False)
                     .agg(Enrolled=("Student ID", "count"), Present=("Present", "sum")))
        summary["Rate"] = (summary["Present"] / summary["Enrolled"]).map("{:.0%}".format)
        summary.to_excel(xl, sheet_name="Summary", index=False)
        for sec, part in df.groupby("Section"):
            part.drop(columns="Section").to_excel(xl, sheet_name=sec[:31], index=False)
    print(f"Wrote {path} ({len(df)} rows, {df['Status'].eq('Present').sum()} present)")


if __name__ == "__main__":
    main()
