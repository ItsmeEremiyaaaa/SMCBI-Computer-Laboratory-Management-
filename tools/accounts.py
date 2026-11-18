"""Bulk account tools.

    python accounts.py not-signed-up               # enrolled students with no website account → Excel
    python accounts.py set-status changes.xlsx     # dry run: show what would change
    python accounts.py set-status changes.xlsx --apply
    python accounts.py create-teachers             # dry run: instructors on the class schedule with no account
    python accounts.py create-teachers --apply     # create them (approved), logins saved to out/teacher_accounts.xlsx

changes.xlsx (or .csv) needs two columns: "Student ID" and "Status"
(Enrolled, Inactive, Dropped or Graduated), e.g. to mark graduates at the end of the year.
"""
from __future__ import annotations

import argparse
import re
import secrets
from collections import Counter
from pathlib import Path

import pandas as pd

from comlab import client, fetch_all, out_dir

STATUSES = {"enrolled": "Enrolled", "inactive": "Inactive", "dropped": "Dropped", "graduated": "Graduated"}


def not_signed_up(students: list[dict], profiles: list[dict]) -> pd.DataFrame:
    emails = {p["email"].lower() for p in profiles}
    rows = [{"Student ID": s["student_id"], "Name": s["full_name"], "Email": s["email"], "Year": s["year_level"], "Section": s["section"]}
            for s in students if s.get("status", "Enrolled") == "Enrolled" and s["email"].lower() not in emails]
    return pd.DataFrame(rows, columns=["Student ID", "Name", "Email", "Year", "Section"]).sort_values("Student ID", ignore_index=True)


def status_changes(sheet: pd.DataFrame, students: list[dict]) -> tuple[list[dict], list[str]]:
    """→ (updates [{id, student_id, from, to}], problems). Unknown IDs and statuses are reported, not applied."""
    cols = {c.strip().lower(): c for c in sheet.columns}
    if "student id" not in cols or "status" not in cols:
        return [], ['The sheet needs "Student ID" and "Status" columns.']
    by_id = {s["student_id"].upper(): s for s in students}
    updates, problems = [], []
    for i, r in sheet.iterrows():
        sid = str(r[cols["student id"]]).strip().upper()
        new = STATUSES.get(str(r[cols["status"]]).strip().lower())
        st = by_id.get(sid)
        if not st:
            problems.append(f"Row {i + 2}: unknown Student ID {sid!r}")
        elif not new:
            problems.append(f"Row {i + 2}: unknown status {r[cols['status']]!r} (use {', '.join(STATUSES.values())})")
        elif st.get("status", "Enrolled") != new:
            updates.append({"id": st["id"], "student_id": sid, "from": st.get("status", "Enrolled"), "to": new})
    return updates, problems


def name_key(name: str) -> str:
    """Same as the website's nameKey: "S. April Mariae Libradilla, RVM" -> "april libradilla"."""
    words = [w for w in re.sub(r"[^a-z\s]", " ", name.split(",")[0].lower()).split() if len(w) > 1]
    return f"{words[0]} {words[-1]}" if words else ""


def teacher_plan(schedules: list[dict], profiles: list[dict]) -> list[dict]:
    """Instructors on the class schedule with no account yet -> [{name, email, department}].
    Email is a placeholder first.last@smcbi.edu.ph (edit it in People before going live)."""
    have = {name_key(p["full_name"]) for p in profiles}
    taken = {p["email"].lower() for p in profiles}
    by_key: dict[str, dict] = {}
    for c in schedules:
        name = (c.get("instructor") or "").strip()
        k = name_key(name)
        if not k or k in have:
            continue
        e = by_key.setdefault(k, {"name": name, "courses": Counter()})
        e["courses"][re.split(r"\s+", c["section"].strip())[0].upper()] += 1
    plan = []
    for k, e in sorted(by_key.items()):
        base = k.replace(" ", ".")
        email, n = f"{base}@smcbi.edu.ph", 2
        while email in taken:
            email, n = f"{base}{n}@smcbi.edu.ph", n + 1
        taken.add(email)
        dept = e["courses"].most_common(1)[0][0]
        plan.append({"name": e["name"], "email": email, "department": dept if dept in {"BSIT", "BSBA", "BSHM", "BEED", "BSED"} else None})
    return plan


def read_sheet(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str) if path.suffix.lower() == ".csv" else pd.read_excel(path, dtype=str)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("not-signed-up")
    t = sub.add_parser("create-teachers")
    t.add_argument("--apply", action="store_true", help="actually create the accounts (default is a dry run)")
    p = sub.add_parser("set-status")
    p.add_argument("file", type=Path)
    p.add_argument("--apply", action="store_true", help="actually save (default is a dry run)")
    a = ap.parse_args()

    sb = client()
    if a.cmd == "create-teachers":
        plan = teacher_plan(fetch_all(sb, "class_schedules"), fetch_all(sb, "profiles"))
        for t in plan:
            print(f"{t['name']:<40} {t['email']:<40} {t['department'] or '-'}")
        print(f"{len(plan)} instructors have no account.")
        if not a.apply:
            if plan:
                print("Dry run only. Add --apply to create them.")
            return
        rows = []
        for t in plan:
            password = secrets.token_urlsafe(9)
            meta = {"full_name": t["name"], "account_type": "teacher", **({"department": t["department"]} if t["department"] else {})}
            user = sb.auth.admin.create_user({"email": t["email"], "password": password, "email_confirm": True, "user_metadata": meta}).user
            sb.table("profiles").update({"approved": True, "role": "teacher"}).eq("id", user.id).execute()
            rows.append({"Name": t["name"], "Email": t["email"], "Temporary password": password, "Department": t["department"]})
            print("created", t["email"])
        path = out_dir() / "teacher_accounts.xlsx"
        pd.DataFrame(rows).to_excel(path, index=False)
        print(f"Logins saved to {path} (keep it private; teachers should change their password).")
        return
    students = fetch_all(sb, "students")
    if a.cmd == "not-signed-up":
        df = not_signed_up(students, fetch_all(sb, "profiles"))
        path = out_dir() / "not_signed_up.xlsx"
        df.to_excel(path, index=False)
        print(f"{len(df)} enrolled students have no account yet → {path}")
        return

    updates, problems = status_changes(read_sheet(a.file), students)
    for u in updates:
        print(f"{u['student_id']}: {u['from']} → {u['to']}")
    for x in problems:
        print("SKIP", x)
    print(f"{len(updates)} to change, {len(problems)} skipped.")
    if a.apply:
        for u in updates:
            sb.table("students").update({"status": u["to"]}).eq("id", u["id"]).execute()
        print("Saved.")
    elif updates:
        print("Dry run only. Add --apply to save.")


if __name__ == "__main__":
    main()
