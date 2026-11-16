# ComLab 3D — Design

## Intent
Rebuild the SAD project "Computer Laboratory Reservation and Scheduling Tracking System"
(Laravel + MySQL) as a live web app on Vercel. Keep everything the old system does,
redesign the whole dashboard, and add a 3D view of each lab where every PC shows its live status.
Why: the old app is dated and can't be hosted on Vercel; the owner wants it live and
wants lab monitoring to be visual.

## Goals
- Same features as the old system (see "Feature parity").
- 3D monitoring per PC seat for Computer Laboratory 1, Computer Laboratory 2, Netlab.
- Live: a seat change shows up for every viewer within ~1s, no refresh.
- New, consistent dashboard design across all pages, works on phone and desktop.
- Free to host (Vercel Hobby + Supabase Free).

## Non-goals
- Software installed on lab PCs that reports usage automatically.
- Student logins / student self check-in (students stay records, like the old app). Can come later.
- Email/SMS notifications (old app only had in-app counts).
- Migrating data out of the old MySQL database (old app had no production data to keep).

## Anti-goals (fails even if it "works")
- Any page reachable or data editable without the right login (old admin routes had no auth).
- Heavy 3D that stutters on a school laptop or phone.

## Approaches considered
- **A. React (Vite) on Vercel + Supabase — picked.** One stack, free, Supabase Realtime gives live seat updates, Supabase Auth + row-level security replaces the PHP login code.
- B. Keep Laravel on a paid host, new React 3D front end on Vercel — two hosts, usually not free, keeps the old auth issues, live updates harder.
- C. Front end with sample data only — fastest, but nothing saved or shared, so not "live". Used only as the first visible milestone of A.

## Decided
- Stack: Vite + React 19 + TypeScript + Tailwind v4 (the old repo already used these), react-three-fiber + drei for 3D, Supabase JS client. Static SPA on Vercel with a rewrite of all paths to `index.html`.
- 3D: primitive/instanced boxes for desks, monitors, chairs; no downloaded models. Orbit camera; lab switcher; click a PC to open its panel.
- Per-PC reservations: a reservation is for a whole lab (class) **or** one PC.
- Seat status shown = an approved reservation covering "now" → **Reserved**; otherwise the manual status staff set: **Free / In use / Broken**.

## Roles
- **Admin**: everything; approves teacher accounts and reservations; manages staff, teachers, students, labs/PCs, events.
- **Staff**: monitoring — sets PC status, views reservations and calendar.
- **Teacher**: registers with an `@smcbi.edu.ph` email, waits for admin approval, then requests reservations (lab or PC), manages own calendar events, sees the 3D view read-only.
- Sign-up always creates a pending teacher; admin can approve and change the role. (This replaces separate admin/teacher register pages and the open `/admin/register`.)

## Data (Supabase Postgres, RLS on every table)
- `profiles` (id = auth user, full_name, email, role admin|staff|teacher, approved bool, department BSIT|BSBA|BSHM|BEED|BSED|Admin, course, phone, address)
- `labs` (id, name, rows, cols) — seeded with the 3 labs
- `pcs` (id, lab_id, label e.g. "PC-07", row, col, status free|in_use|broken, note, updated_by, updated_at)
- `students` (student_id unique, full_name, email unique, course, section, year_level 1st–5th Year, phone, address) — records only, same fields as old
- `reservations` (title, lab_id, pc_id nullable, purpose, date, start_time, end_time, requester_id, participants, requirements, status pending|approved|rejected|completed, admin_notes, reviewed_by, reviewed_at, created_at)
- `events` (title, description, event_date, event_time, event_type academic|personal|holiday|meeting, owner_id)
- Rules carried from old validation: date ≥ today, end > start, department/course/year enums, unique emails/student IDs.
- Approving a reservation must fail if it overlaps another approved one for the same lab (whole-lab) or same PC, enforced in the database.

## Feature parity (old → new)
| Old | New page |
|---|---|
| Admin dashboard + stats (staff, students, courses) | Dashboard: stat cards + live lab overview + pending items |
| Manage Staff CRUD | People → Staff (profiles with role staff) |
| Manage Teachers CRUD + teacher requests | People → Teachers, with approve/reject pending sign-ups |
| Manage Students CRUD | People → Students |
| Calendar events CRUD | Calendar |
| Computer reservations + approve/reject + by lab/date + statistics | Reservations (list, filters, approve/reject with notes) |
| Teacher dashboard, teaching calendar, request reservation | Teacher home: my reservations, my calendar, request form |
| Notifications / pending counts | Bell with pending reservations + pending teacher sign-ups |
| — | **Labs 3D**: live per-PC monitoring |

## Delivery
1. Redesigned UI + 3D view on sample data (visible quickly).
2. Supabase schema, auth, RLS, realtime; swap sample data for real.
3. Deploy to Vercel; README with setup.

## Open (owner's answers needed)
- PCs per lab and layout (default: 30 PCs, 5 rows × 6, all three labs).
- Code location: new GitHub repo (default) vs replacing the old repo.
- OK to create a free Supabase project under the owner's connected account.

## Left to the builder
Visual style, component structure, exact conflict-check SQL, seed data, test approach.
