# ComLab Monitor

Live 3D monitoring and reservations for the SMCBI computer laboratories: Computer Laboratory 1, Computer Laboratory 2 and Netlab.
It's a redesign of the original *Computer Laboratory Reservation and Scheduling Tracking System*, a Laravel + MySQL SAD project, rebuilt so it can run on Vercel for free.

## What it does

| Old system | New page |
|---|---|
| Admin dashboard and stats | **Overview**: stats, live mini floor plan of each lab, today's schedule, pending queue |
| Computer reservations, approve/reject, by lab/date, statistics | **Reservations**: book a whole lab *or a single PC*, filters, approve/reject with notes, mark completed |
| Teacher dashboard and teaching calendar | **Overview** (teacher view) and **Calendar** |
| Manage Staff / Teachers / Students | **People** (admin only) |
| Calendar events | **Calendar**: events plus approved bookings |
| Notifications | Bell with pending requests and new teacher sign-ups |
| — | **Labs**: a 3D model of each lab where every PC shows *Free / In use / Reserved / Broken* live |

**Roles:**
- **Admin** manages everything.
- **Staff** set PC status.
- **Teachers** sign up with an `@smcbi.edu.ph` email, wait for admin approval, then request labs or PCs.

## Run it locally

```bash
npm install
npm run dev
```

With no Supabase settings, the app runs in **demo mode** with sample data saved in your browser. Sign in with the Admin, Staff or Teacher button on the login page.

```bash
npm test        # unit and component tests
npm run build   # production build (what Vercel runs)
```

## Connect a real database (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com). The free plan allows 2 active projects, so pause an unused one if needed. Singapore is the closest region.
2. Open **SQL Editor**, paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**. This creates the tables, the security rules, live updates, and the 3 labs with 30 PCs each.
3. Optional: run [`supabase/tests/policies.sql`](supabase/tests/policies.sql). Every row should say `ok = true`, and it rolls back, so no data is left behind.
4. Copy `.env.example` to `.env.local` and fill in **Project URL** and the **publishable (anon) key** from *Project Settings → API*.
5. Sign up in the app with your school email, then make yourself the first admin in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin', approved = true where email = 'you@smcbi.edu.ph';
   ```
6. In *Authentication → URL Configuration*, set **Site URL** to your Vercel URL once you have it.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, click **Add New → Project** and import the repo. Vercel detects Vite on its own.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then click **Deploy**.

`vercel.json` already sends every path to the app, so refreshing `/reservations` works.

## Changing the labs

The number of PCs and the layout per lab live in the `labs` table (`rows`, `cols`) and the `pcs` table. To give Lab 1 seven rows of six PCs, for example, update `labs` and insert the extra `pcs` rows. The 3D view and floor plan follow the data.

## Stack

Vite, React 19, TypeScript, Tailwind CSS 4, three.js (react-three-fiber + drei), Supabase (Postgres, Auth, Realtime, row-level security).
