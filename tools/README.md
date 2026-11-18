# ComLab admin tools (Python)

Scripts the lab admin runs on their own PC. They talk to the live Supabase database with the
**service key**, which has full admin rights: keep `tools/.env` on the admin PC only, never in Git or the website.

## Setup (once)

```
D:\Python312\python.exe -m venv D:\venvs\comlab
D:\venvs\comlab\Scripts\pip install -r tools\requirements.txt
copy tools\.env.example tools\.env      (then paste the service_role key into it)
```

Run every command from the `tools` folder with `D:\venvs\comlab\Scripts\python.exe <script> …`.
Output files go to `tools\out\`.

| Script | What it does |
|---|---|
| `attendance.py 2026-11-01 2026-11-30 [--section "BSIT 1A"]` | Attendance per class session from QR check-ins → Excel, one sheet per section plus a summary |
| `usage_report.py 2026-11` | Monthly report → Excel: class/booking hours per lab, busiest PCs, student no-shows, broken PCs |
| `accounts.py not-signed-up` | Enrolled students who haven't created a website account → Excel |
| `accounts.py set-status changes.xlsx [--apply]` | Bulk status change (e.g. graduates) from a sheet with "Student ID" and "Status" columns; dry run unless `--apply` |
| `backup.py [--dir D:\backups]` | Every table → one dated Excel file. Supabase's free plan has no automatic backups, so run it weekly (Task Scheduler) |

Tests (offline, no database needed): `D:\venvs\comlab\Scripts\python.exe -m pytest tools`

Jobs that must run even when no PC is on live inside Supabase instead: see
`supabase/migrations/0007_housekeeping_jobs.sql` (closes forgotten check-ins, completes ended bookings, every 15 minutes).
