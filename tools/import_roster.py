"""Import the registrar's student list (Excel/CSV) into the students table.

    python import_roster.py data\\bsit_2026.xlsx                          # dry run: shows what would change
    python import_roster.py data\\bsit_2026.xlsx --apply                  # save
    python import_roster.py data\\bsit_2026.xlsx --remove-placeholders --apply

Start from templates\\student_roster_template.xlsx. Column names are matched loosely, so the
registrar's own headings usually work too (e.g. "ID No.", "Name", "Gender", "Year", "Sec").
Required: Student ID, Full Name, Course, Year Level, Section. Optional: Sex, Email, Phone, Address.
Email defaults to <student id>@smcbi.edu.ph. Students are matched by Student ID (added or updated).
--remove-placeholders deletes only the generated "1st Year Student 001"-style rows that aren't in the file.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

from comlab import client, fetch_all

COURSES = {"BSIT", "BSBA", "BSHM", "BEED", "BSED"}
ALIASES = {
    "student_id": ["student id", "student no", "student number", "id no", "id number", "id", "stud id"],
    "full_name": ["full name", "name", "student name", "complete name"],
    "last": ["last name", "surname", "family name"],
    "first": ["first name", "given name"],
    "middle": ["middle name", "middle initial", "mi"],
    "sex": ["sex", "gender"],
    "course": ["course", "program", "degree"],
    "year_level": ["year level", "year", "yr", "yr level", "level"],
    "section": ["section", "sec", "block"],
    "email": ["email", "email address", "school email"],
    "phone": ["phone", "contact", "contact no", "contact number", "mobile", "cellphone"],
    "address": ["address", "home address"],
}
YEARS = {"1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year", "5": "5th Year",
         "first": "1st Year", "second": "2nd Year", "third": "3rd Year", "fourth": "4th Year", "fifth": "5th Year",
         "i": "1st Year", "ii": "2nd Year", "iii": "3rd Year", "iv": "4th Year", "v": "5th Year"}
PLACEHOLDER = re.compile(r"^\d(st|nd|rd|th) Year Student \d{3}$")


def _key(h: str) -> str:
    return re.sub(r"[^a-z ]", "", str(h).lower()).strip()


def _cell(row: pd.Series, cols: dict[str, str], field: str) -> str:
    v = row.get(cols[field]) if field in cols else None
    return "" if v is None or pd.isna(v) else str(v).strip()


def year_of(v: str) -> str | None:
    v = v.lower().replace("year", "").replace("yr", "").strip().rstrip(".")
    # words first ("first" ends in "st" too), then "1st" → "1"
    return YEARS.get(v) or YEARS.get(re.sub(r"(st|nd|rd|th)$", "", v).strip())


def parse(sheet: pd.DataFrame) -> tuple[list[dict], list[str]]:
    """→ (clean student records, problems). Rows with problems are skipped, never half-saved."""
    cols = {}
    for field, names in ALIASES.items():
        for h in sheet.columns:
            if _key(h) in names and field not in cols:
                cols[field] = h
    missing = [f for f in ("student_id", "course", "year_level", "section") if f not in cols]
    if "full_name" not in cols and not {"last", "first"} <= cols.keys():
        missing.append("full_name (or Last Name + First Name)")
    if missing:
        return [], [f"Missing column(s): {', '.join(missing)}. Found: {', '.join(map(str, sheet.columns))}"]

    out, problems, seen = [], [], set()
    for i, row in sheet.iterrows():
        n = i + 2  # Excel row number (row 1 = headings)
        sid = _cell(row, cols, "student_id").upper().replace(" ", "").replace("-", "")
        if not sid:
            continue  # blank line
        name = _cell(row, cols, "full_name") if "full_name" in cols else \
            " ".join(x for x in (_cell(row, cols, "first"), _cell(row, cols, "middle"), _cell(row, cols, "last")) if x)
        name = re.sub(r"\s+", " ", name).title() if name.isupper() or name.islower() else re.sub(r"\s+", " ", name)
        course = _cell(row, cols, "course").upper().replace(" ", "").replace("-", "")
        year = year_of(_cell(row, cols, "year_level"))
        section = _cell(row, cols, "section").upper()
        section = section[-1] if section and section[-1].isalpha() else section  # "1A" / "BSIT 1-A" → "A"
        sex = {"m": "Male", "male": "Male", "f": "Female", "female": "Female"}.get(_cell(row, cols, "sex").lower())
        email = (_cell(row, cols, "email") or f"{sid.lower()}@smcbi.edu.ph").lower()

        errs = []
        if not re.fullmatch(r"C\d{6}", sid): errs.append(f"Student ID {sid!r} should look like C230505")
        if sid in seen: errs.append(f"duplicate Student ID {sid}")
        if not name: errs.append("no name")
        if course not in COURSES: errs.append(f"course {course!r} not one of {', '.join(sorted(COURSES))}")
        if not year: errs.append(f"year level {_cell(row, cols, 'year_level')!r} not understood")
        if not section: errs.append("no section")
        if _cell(row, cols, "sex") and not sex: errs.append(f"sex {_cell(row, cols, 'sex')!r} should be Male/Female")
        if not email.endswith("@smcbi.edu.ph"): errs.append(f"email {email!r} is not a school email")
        if errs:
            problems.append(f"Row {n}: " + "; ".join(errs))
            continue
        seen.add(sid)
        out.append({"student_id": sid, "full_name": name, "email": email, "course": course, "year_level": year,
                    "section": section, "sex": sex, "status": "Enrolled",
                    "phone": re.sub(r"\D", "", _cell(row, cols, "phone")) or None, "address": _cell(row, cols, "address") or None})
    return out, problems


def plan(records: list[dict], existing: list[dict], remove_placeholders: bool) -> dict:
    by_id = {s["student_id"].upper(): s for s in existing}
    fields = ("full_name", "email", "course", "year_level", "section", "sex", "phone", "address")
    add = [r for r in records if r["student_id"] not in by_id]
    update = [{**r, "id": by_id[r["student_id"]]["id"]} for r in records
              if r["student_id"] in by_id and any((by_id[r["student_id"]].get(f) or None) != (r[f] or None) for f in fields)]
    keep = {r["student_id"] for r in records}
    remove = [s for s in existing if remove_placeholders and s["student_id"].upper() not in keep and PLACEHOLDER.match(s["full_name"])]
    return {"add": add, "update": update, "remove": remove}


def read_sheet(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str) if path.suffix.lower() == ".csv" else pd.read_excel(path, dtype=str)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", type=Path)
    ap.add_argument("--remove-placeholders", action="store_true")
    ap.add_argument("--apply", action="store_true", help="actually save (default is a dry run)")
    a = ap.parse_args()

    records, problems = parse(read_sheet(a.file))
    for p in problems:
        print("SKIP", p)
    sb = client()
    p = plan(records, fetch_all(sb, "students"), a.remove_placeholders)
    print(f"{len(records)} valid rows: {len(p['add'])} to add, {len(p['update'])} to update, "
          f"{len(records) - len(p['add']) - len(p['update'])} unchanged; {len(p['remove'])} placeholders to remove; {len(problems)} rows skipped.")
    if not a.apply:
        print("Dry run only. Add --apply to save.")
        return
    # emails are unique too, so placeholders go first (a real student may take over a placeholder's email)
    for s in p["remove"]:
        sb.table("students").delete().eq("id", s["id"]).execute()
    for r in p["update"]:
        sb.table("students").update({k: v for k, v in r.items() if k not in ("id", "student_id")}).eq("id", r["id"]).execute()
    for i in range(0, len(p["add"]), 500):
        sb.table("students").insert(p["add"][i:i + 500]).execute()
    print("Saved.")


if __name__ == "__main__":
    main()
