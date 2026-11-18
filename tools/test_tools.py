"""Offline tests for the report logic: python -m pytest tools"""
from datetime import date, datetime

import pandas as pd

from accounts import not_signed_up, status_changes
from attendance import attendance
from comlab import MANILA, class_days, in_section
from usage_report import broken, lab_hours, no_shows, pc_usage

# Wednesday classes, 2026-11-02 .. 2027-03-31
CLS = {"id": "c1", "lab_id": "lab2", "section": "BSIT 1A", "subject": "IT112", "instructor": "X",
       "day_of_week": 3, "start_time": "09:00:00", "end_time": "12:00:00", "starts_on": "2026-11-02", "ends_on": "2027-03-31"}
STU = [
    {"id": "s1", "student_id": "C260001", "full_name": "Ana", "email": "c260001@smcbi.edu.ph", "course": "BSIT", "year_level": "1st Year", "section": "A", "status": "Enrolled"},
    {"id": "s2", "student_id": "C260002", "full_name": "Ben", "email": "c260002@smcbi.edu.ph", "course": "BSIT", "year_level": "1st Year", "section": "A", "status": "Enrolled"},
    {"id": "s3", "student_id": "C260003", "full_name": "Cy", "email": "c260003@smcbi.edu.ph", "course": "BSIT", "year_level": "1st Year", "section": "B", "status": "Enrolled"},
]
PROF = [{"id": "u1", "email": "C260001@smcbi.edu.ph", "role": "student"}]
# UTC timestamps: 00:55Z = 08:55 Manila (5 min before class), 05:00Z = 13:00 Manila (after class)
CHK = [
    {"id": "k1", "pc_id": "lab2-pc05", "lab_id": "lab2", "user_id": "u1", "checked_in_at": "2026-11-18T00:55:00+00:00", "checked_out_at": "2026-11-18T03:55:00+00:00"},
    {"id": "k2", "pc_id": "lab2-pc05", "lab_id": "lab2", "user_id": "u1", "checked_in_at": "2026-11-25T05:00:00+00:00", "checked_out_at": None},
]


def test_class_days_and_sections():
    assert class_days(CLS, date(2026, 11, 1), date(2026, 11, 30)) == [date(2026, 11, d) for d in (4, 11, 18, 25)]
    assert in_section(STU[0], "BSIT 1A") and not in_section(STU[2], "BSIT 1A")
    assert in_section({**STU[0], "year_level": "4th Year", "section": "B"}, "BSIT 4")  # no letter = whole year


def test_attendance_counts_checkins_in_the_session_window():
    df = attendance([CLS], STU, PROF, CHK, date(2026, 11, 18), date(2026, 11, 25))
    assert len(df) == 4  # 2 sessions × 2 students of BSIT 1A (Cy is in 1B)
    ana = df[df["Name"] == "Ana"].set_index("Date")["Status"].to_dict()
    assert ana == {"2026-11-18": "Present", "2026-11-25": "Absent"}  # 2nd check-in was after class
    assert df.loc[(df["Name"] == "Ana") & (df["Date"] == "2026-11-18"), "Checked in"].item() == "08:55"
    assert set(df[df["Name"] == "Ben"]["Status"]) == {"Absent"}


def test_usage_report_parts():
    res = [{"lab_id": "netlab", "status": "approved", "date": "2026-11-20", "start_time": "09:00", "end_time": "10:30",
            "requester_id": "u1", "requester_name": "Ana", "pc_id": "netlab-pc01", "title": "Practice"}]
    labs = lab_hours([CLS], res, date(2026, 11, 1), date(2026, 11, 30)).set_index("Lab")
    assert labs.loc["ComLab 2", "Class hours"] == 12  # 4 Wednesdays × 3 h
    assert labs.loc["NetLab", "Booking hours"] == 1.5

    pcs = [{"id": "lab2-pc05", "lab_id": "lab2", "label": "PC-05", "status": "broken", "note": "No display", "updated_at": "2026-11-10T02:00:00+00:00"}]
    now = datetime(2026, 11, 30, 12, tzinfo=MANILA)
    use = pc_usage(CHK, pcs, date(2026, 11, 1), date(2026, 11, 30), now)
    assert use.loc[0, "Check-ins"] == 2 and use.loc[0, "Hours"] == 14.0  # closed 3 h + open 13:00-23:59, rounded
    assert no_shows(res, CHK, PROF, date(2026, 11, 1), date(2026, 11, 30), now)["Student"].tolist() == ["Ana"]
    assert broken(pcs).loc[0, "Since"] == "2026-11-10 10:00"


def test_account_tools():
    assert not_signed_up(STU, PROF)["Student ID"].tolist() == ["C260002", "C260003"]
    sheet = pd.DataFrame({"Student ID": ["c260001", "C269999", "C260002"], "Status": ["graduated", "Graduated", "gone"]})
    updates, problems = status_changes(sheet, STU)
    assert [(u["student_id"], u["to"]) for u in updates] == [("C260001", "Graduated")]
    assert len(problems) == 2 and "unknown Student ID" in problems[0] and "unknown status" in problems[1]
