"""Back up every ComLab table to one dated Excel file (one sheet per table).

    python backup.py                 # → tools/out/backup_2026-11-18.xlsx
    python backup.py --dir D:\\backups

Run it weekly (Windows Task Scheduler works). Supabase's free plan has no automatic backups.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from comlab import client, fetch_all, out_dir, today_manila

TABLES = ["profiles", "students", "labs", "pcs", "reservations", "class_schedules", "events", "checkins"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", type=Path, default=None)
    a = ap.parse_args()
    folder = a.dir or out_dir()
    folder.mkdir(parents=True, exist_ok=True)

    sb = client()
    path = folder / f"backup_{today_manila()}.xlsx"
    with pd.ExcelWriter(path) as xl:
        for t in TABLES:
            rows = fetch_all(sb, t)
            pd.DataFrame(rows).to_excel(xl, sheet_name=t, index=False)
            print(f"{t}: {len(rows)} rows")
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
