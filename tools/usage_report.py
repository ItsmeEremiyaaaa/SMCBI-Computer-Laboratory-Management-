"""Monthly lab usage report → Excel.

    python usage_report.py 2026-11        # November 2026

Sheets:
  Labs       scheduled class hours and approved booking hours per lab
  PCs        check-ins and hours used per PC (busiest first)
  No-shows   approved student bookings with no check-in during the slot
  Broken     PCs currently marked broken, with their note and since when
"""
from __future__ import annotations

import argparse
from calendar import monthrange
from datetime import date, datetime

import pandas as pd

from comlab import MANILA, LAB_NAME, class_days, client, fetch_all, hm, out_dir, to_manila


def hours(a: str, b: str) -> float:
    t0, t1 = hm(a), hm(b)
    return (t1.hour * 60 + t1.minute - t0.hour * 60 - t0.minute) / 60


def lab_hours(schedules: list[dict], reservations: list[dict], start: date, end: date, labs: list[str] = ()) -> pd.DataFrame:
    """Every lab gets a row, even one with no classes or bookings (zeros)."""
    rows = []
    for lab in sorted(set(labs) | {s["lab_id"] for s in schedules} | {r["lab_id"] for r in reservations}):
        cls = sum(hours(s["start_time"], s["end_time"]) * len(class_days(s, start, end)) for s in schedules if s["lab_id"] == lab)
        bk = [r for r in reservations if r["lab_id"] == lab and r["status"] in ("approved", "completed")
              and start.isoformat() <= r["date"] <= end.isoformat()]
        rows.append({"Lab": LAB_NAME.get(lab, lab), "Class hours": round(cls, 1), "Booking hours": round(sum(hours(r["start_time"], r["end_time"]) for r in bk), 1),
                     "Bookings": len(bk)})
    return pd.DataFrame(rows)


def pc_usage(checkins: list[dict], pcs: list[dict], start: date, end: date, now: datetime) -> pd.DataFrame:
    label = {p["id"]: (LAB_NAME.get(p["lab_id"], p["lab_id"]), p["label"]) for p in pcs}
    rows: dict[str, dict] = {pid: {"Lab": lab, "PC": lbl, "Check-ins": 0, "Hours": 0.0} for pid, (lab, lbl) in label.items()}
    for c in checkins:
        t0 = to_manila(c["checked_in_at"])
        if not (start <= t0.date() <= end) or c["pc_id"] not in rows:
            continue
        # open check-ins count until now, but never past the end of that day
        t1 = to_manila(c["checked_out_at"]) if c.get("checked_out_at") else min(now, t0.replace(hour=23, minute=59))
        rows[c["pc_id"]]["Check-ins"] += 1
        rows[c["pc_id"]]["Hours"] += max(0.0, (t1 - t0).total_seconds() / 3600)
    df = pd.DataFrame(rows.values())
    df["Hours"] = df["Hours"].round(1)
    return df.sort_values(["Hours", "Check-ins"], ascending=False, ignore_index=True)


def no_shows(reservations: list[dict], checkins: list[dict], profiles: list[dict], start: date, end: date, now: datetime) -> pd.DataFrame:
    students = {p["id"] for p in profiles if p["role"] == "student"}
    rows = []
    for r in reservations:
        if r["status"] not in ("approved", "completed") or r["requester_id"] not in students:
            continue
        day = date.fromisoformat(r["date"])
        t0, t1 = datetime.combine(day, hm(r["start_time"]), MANILA), datetime.combine(day, hm(r["end_time"]), MANILA)
        if not (start <= day <= end) or t1 > now:
            continue  # not finished yet
        came = any(c["user_id"] == r["requester_id"] and c["lab_id"] == r["lab_id"] and t0 <= to_manila(c["checked_in_at"]) < t1
                   for c in checkins)
        if not came:
            rows.append({"Date": r["date"], "Time": f"{r['start_time'][:5]}-{r['end_time'][:5]}", "Student": r["requester_name"],
                         "Lab": LAB_NAME.get(r["lab_id"], r["lab_id"]), "PC": (r.get("pc_id") or "").split("-")[-1].upper(), "Title": r["title"]})
    return pd.DataFrame(rows, columns=["Date", "Time", "Student", "Lab", "PC", "Title"])


def broken(pcs: list[dict]) -> pd.DataFrame:
    rows = [{"Lab": LAB_NAME.get(p["lab_id"], p["lab_id"]), "PC": p["label"], "Note": p.get("note") or "",
             "Since": to_manila(p["updated_at"]).strftime("%Y-%m-%d %H:%M")} for p in pcs if p["status"] == "broken"]
    return pd.DataFrame(rows, columns=["Lab", "PC", "Note", "Since"])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("month", help="YYYY-MM")
    a = ap.parse_args()
    y, m = map(int, a.month.split("-"))
    start, end = date(y, m, 1), date(y, m, monthrange(y, m)[1])
    now = datetime.now(MANILA)

    sb = client()
    schedules, reservations = fetch_all(sb, "class_schedules"), fetch_all(sb, "reservations")
    pcs, checkins, profiles = fetch_all(sb, "pcs"), fetch_all(sb, "checkins"), fetch_all(sb, "profiles")

    path = out_dir() / f"usage_{a.month}.xlsx"
    with pd.ExcelWriter(path) as xl:
        lab_hours(schedules, reservations, start, end, [p["lab_id"] for p in pcs]).to_excel(xl, sheet_name="Labs", index=False)
        pc_usage(checkins, pcs, start, end, now).to_excel(xl, sheet_name="PCs", index=False)
        no_shows(reservations, checkins, profiles, start, end, now).to_excel(xl, sheet_name="No-shows", index=False)
        broken(pcs).to_excel(xl, sheet_name="Broken", index=False)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
