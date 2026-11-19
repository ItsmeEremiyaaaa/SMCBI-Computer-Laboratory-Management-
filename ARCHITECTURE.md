# ComLab Monitor architecture

**Short version:** a modular monolith with layered modules and a repository contract per module. One binding picks the live or demo backend (dependency inversion). Written in strict TypeScript (React) on a PostgreSQL backend (Supabase), where the database itself enforces the rules.

It follows the same ideas as a Laravel REST API (modules, layers, repositories, interfaces, SOLID), adapted to this stack. There is no separate PHP server; **Supabase is the backend**:
- PostgreSQL tables
- row-level security (database access rules)
- triggers and RPC functions
- realtime
- auth

The React app is the client. Laravel-only tools that have no equivalent here are listed at the end.

---

## 1. Shape of the code (modular monolith, grouped by feature)

```
src/
  app/                  shell: routes (App.tsx), layout + sidebar, start-up (main.tsx)
  shared/               used by every module
    data/               the data gateway: api.ts (contract + binding), supabase.ts (live), mock.ts (demo), types.ts (DTOs)
    ui/                 UI kit: buttons, fields, modals, confirm dialog, badges
    hooks/              useLoad, useCleared
    time.ts             Manila clock, weekdays, slot overlap, lab hours 8 AM–8 PM
  modules/
    auth/               sign-in, sign-up, password reset, school-email rules
    labs/               3D view, floor plan, PC card, PC status rules, check-in, QR codes, lab maintenance
    bookings/           reservations, booking rules, usage hours
    schedule/           weekly classes, semesters
    people/             teacher/staff/student accounts, student records, section rules
    calendar/           school events, day timeline
    dashboard/          admin overview, student home
    notifications/      inbox + bells (admin and student)
    reports/            PC problem reports
    archive/            recycle bin: restore / delete forever
supabase/migrations/    the database, in numbered steps (tables, rules, triggers, policies)
tools/                  admin Python scripts (reports, imports, backups, account creation)
```

Every module has the same folders, one job each:

| Folder | Job |
|---|---|
| `ui/` | Screens and their components |
| `hooks/` | Screen state (e.g. `useLabLive` keeps a lab's PCs live) |
| `logic/` | Business rules and validation: plain functions, no screen code, unit-tested |
| `data/repository.ts` | The module's repository contract: the only database calls it may make |

Modules talk to each other only through `logic/` (rules) and `data/` (repositories), never through another module's screens.

## 2. The layers (one request, top to bottom)

```
Route → Guard + Validation → Screen → DTO → Service (logic) → Repository → Gateway → Database (tables, triggers, RLS) → Realtime → Screen
```

| Laravel layer | ComLab equivalent | Where |
|---|---|---|
| Route | React Router routes | `app/App.tsx` |
| FormRequest (validation + authorization) | Route guard `<Only roles>` + `logic/validate…` functions, and again in the database (triggers + RLS) | `app/App.tsx`, `modules/*/logic/*.ts`, `supabase/migrations` |
| Thin Controller | The screen: receives input, calls rules + repository, shows the result | `modules/*/ui/*.tsx` |
| DTO | Typed input shapes (`ReservationInput`, `ScheduleInput`, `StudentInput`, `EventInput`) | `shared/data/types.ts`, `shared/data/api.ts` |
| Service | `logic/` rule functions (`bookingProblems`, `validateReservation`, `effectiveStatuses`, `termOf`…) | `modules/*/logic/*.ts` |
| Repository | `bookingsRepo`, `labsRepo`, `peopleRepo`… | `modules/*/data/repository.ts` |
| Model (Active Record) | PostgreSQL tables, reached through the gateway | `shared/data/supabase.ts`, `supabase/migrations` |
| Resource (formatter) | `fmtDate`, `fmtTime`, `STATUS_LABEL`, badges: shape data for display | `shared/ui/ui.tsx` |

Example, approving a booking:
1. The route `/reservations` opens `bookings/ui/Reservations.tsx`.
2. The admin clicks Approve.
3. The screen calls `bookingsRepo.reviewReservation()`.
4. The database trigger `reservation_rules` stamps `reviewed_by`/`reviewed_at`, takes a lock, and refuses a clash.
5. Realtime tells every open screen.
6. The student's bell shows "Booking approved".

## 3. Wiring (contracts, injection, binding)

| Practice | ComLab |
|---|---|
| Interfaces (contracts) | `Api` in `shared/data/api.ts` is the full contract. Each module's `XRepository = Pick<Api, …>` is that module's narrow contract. Screens depend on *what* (the contract), not *how* (Supabase). |
| Service Provider / IoC binding | One line in `shared/data/api.ts`: Supabase settings present → `createSupabaseApi()`, otherwise → `createMock()` (demo). Nothing else in the app knows which backend runs. |
| Dependency Inversion | Screens and rules never import Supabase. Swapping the backend (or the demo backend in tests) changes one binding. |
| Dependency Injection | React context for the signed-in user (`useAuth`); repositories are module singletons bound once. *Partial:* there is no constructor injection container. |

## 4. SOLID / clean code

| Principle | Example |
|---|---|
| Single Responsibility | Each module owns one area; inside it, `ui` shows, `logic` decides, `data` fetches |
| DRY | One status rule (`effectiveStatuses`) for the 3D view, floor plan, dashboard and PC card; one `Modal`/`askConfirm` for every dialog; one `useLoad` for loading |
| Guard clauses / fail fast | `checkInProblem` and `bookingProblems` return the first clear reason; database triggers `raise exception` with a plain message |
| Composition | Small hooks (`useLoad`, `useCleared`, `useExclusive`) combined in screens instead of inheritance |
| ⚠️ Big files to split later | `labs/ui/LabScene.tsx` (~1,000 lines) and `labs/ui/LabCharacters3D.tsx` (~900) are the "god files" of this app. They are 3D drawing code, not business logic, but should be broken into smaller parts. |

## 5. Database practices (PostgreSQL / Supabase)

| Practice | Where | Why |
|---|---|---|
| Transactions | Each trigger + insert/update is one transaction; `archive_row`/`restore_row` RPCs move data in one step | All-or-nothing saves |
| Pessimistic locking | `pg_advisory_xact_lock` in `reservation_rules` | Two people approving clashing bookings at the same moment can't both win |
| Soft deletes | `archive` table + `archive_row` / `restore_row` / purge | Recycle bin instead of real deletion |
| Mass-assignment protection | Triggers overwrite `requester_id`, `status`, `reviewed_by`; `protect_profile` blocks role/approval changes | Users can't fake who asked or approve themselves |
| Hidden secrets | Passwords live only in Supabase Auth; the service key stays in `tools/.env` on the admin PC | Never sent to the browser |
| UUIDs | Accounts, bookings, reports use UUID ids | IDs can't be guessed |
| After-commit notifications | Realtime only fires after a change is committed | Nobody is notified about a save that failed |
| Timezone awareness | `Asia/Manila` in `shared/time.ts` and in SQL (`now() at time zone 'Asia/Manila'`) | Correct dates for the Philippines |
| Scheduled jobs | `pg_cron` housekeeping every 15 min (migration 0007) | Closes forgotten check-ins, completes ended bookings |
| Eager loading / N+1 | *Partial:* screens load lists in parallel (`Promise.all`); there are no per-row queries in loops | Fast pages |

## 6. Data and types

| Practice | ComLab |
|---|---|
| Strict types | `"strict": true` in `tsconfig`; every function typed |
| Enums | String-literal unions: `Role`, `PcStatus`, `ResStatus`, `ShownStatus`, plus `check (… in (…))` in the database |
| State machine | Bookings: pending → approved / rejected → completed / cancelled. PCs: free / in use / reserved / maintenance / broken |
| Input normalization | `schoolEmail()` (an ID alone becomes `id@smcbi.edu.ph`), trimming, `nullif(trim(...))` in SQL |
| Naming | Database `snake_case` is used as-is in the app (no conversion layer) |

## 7. Background work and real-time

| Practice | ComLab |
|---|---|
| Broadcasting / WebSockets | Supabase Realtime: one channel per table (bookings, classes, reports, accounts, PCs) |
| Background jobs | `pg_cron` in the database; Windows Task Scheduler runs `tools/backup.py` weekly |
| Notifications | In-app bells + Notifications page, built from the data (no separate notification table) |
| Push notifications | *Not used* (in-app only) |

## 8. Security

| Practice | ComLab |
|---|---|
| Token auth | Supabase Auth: short-lived access token + refresh token |
| Policies ("can you act on this record?") | Row-level security on every table, e.g. students read only their own reports |
| Roles | admin › staff › teacher › student (`has_role()` in SQL, `<Only roles>` in routes) |
| Ownership in the query | RLS policies such as `requester_id = auth.uid()` |
| Signed URLs | Email confirmation and password-reset links |
| Rate limiting | Supabase Auth's built-in limits on sign-in and email |
| No user enumeration | Wrong email and wrong password give the same "Invalid login credentials" message |
| Audit trail | `reviewed_by`/`reviewed_at` on bookings, `updated_by` on PCs, `archived_by` in the archive, `resolved_at` on reports |
| Idempotency | Clearing a notification twice changes nothing; restoring an archived row checks it still fits |
| 2FA / passkeys | *Not used* |

## 9. Tooling

| Tool | Purpose |
|---|---|
| Vite | Dev server and build (`npm run dev`, `npm run build`) |
| Vitest + Testing Library | Unit and screen tests (`npx vitest run`) |
| TypeScript compiler | Type checking (`npx tsc -b`) |
| ESLint | Code checks |
| Python tools (`tools/`) | The "Artisan commands" of this app: roster import, attendance, usage report, account creation, backups |
| Supabase SQL migrations | Database changes, in numbered order |

### Laravel-only items with no equivalent here

These belong to a PHP/Laravel server, which ComLab doesn't have:
- Octane, Telescope/Pulse, Pint
- Swagger/OpenAPI attributes
- Scout
- Sanctum's token-purpose middleware
- Bouncer
- Queued PHP jobs
- `strict_types`

Their *jobs* are covered by the rows above where it makes sense.
