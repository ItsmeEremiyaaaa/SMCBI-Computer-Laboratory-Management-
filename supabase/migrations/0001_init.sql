-- ComLab Monitor schema. Every table has RLS; the database enforces roles and booking conflicts.

-- ============ tables ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'teacher' check (role in ('admin', 'staff', 'teacher')),
  approved boolean not null default false,
  department text check (department in ('BSIT', 'BSBA', 'BSHM', 'BEED', 'BSED', 'Admin')),
  course text,
  phone text check (phone ~ '^\d{11}$'),
  address text,
  created_at timestamptz not null default now()
);

create table public.labs (
  id text primary key,
  name text not null unique,
  rows int not null check (rows between 1 and 20),
  cols int not null check (cols between 1 and 20)
);

create table public.pcs (
  id text primary key,
  lab_id text not null references public.labs on delete cascade,
  label text not null,
  row int not null,
  col int not null,
  status text not null default 'free' check (status in ('free', 'in_use', 'broken')),
  note text check (char_length(note) <= 120),
  updated_by uuid references public.profiles on delete set null,
  updated_at timestamptz not null default now(),
  unique (lab_id, label),
  unique (lab_id, row, col)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  full_name text not null,
  email text not null unique,
  course text not null check (course in ('BSIT', 'BSBA', 'BSHM', 'BEED', 'BSED')),
  section text not null,
  year_level text not null check (year_level in ('1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year')),
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  lab_id text not null references public.labs on delete cascade,
  pc_id text references public.pcs on delete cascade,
  purpose text not null check (char_length(trim(purpose)) > 0),
  date date not null,
  start_time time not null,
  end_time time not null,
  requester_id uuid not null references public.profiles on delete cascade,
  requester_name text not null default '',
  participants int check (participants >= 1),
  requirements text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  admin_notes text,
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on public.reservations (lab_id, date);
create index on public.reservations (status);
create index on public.reservations (requester_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  event_date date not null,
  event_time time not null,
  event_type text not null check (event_type in ('academic', 'personal', 'holiday', 'meeting')),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

-- ============ helpers ============
-- Role of the signed-in user, or null if not signed in / not approved.
create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and approved
$$;

create function public.has_role(variadic roles text[]) returns boolean
language sql stable as $$ select coalesce(public.my_role() = any(roles), false) $$;

create function public.is_approved() returns boolean
language sql stable as $$ select public.my_role() is not null $$;

-- ============ triggers ============
-- New auth user -> pending teacher profile. Only school emails may register.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email !~* '^[^@\s]+@smcbi\.edu\.ph$' then
    raise exception 'Use your @smcbi.edu.ph email.';
  end if;
  insert into public.profiles (id, full_name, email, department, course)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'course', '')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change role/approved/email; nobody changes their own role or approval.
create function public.protect_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.role, new.approved, new.email) is distinct from (old.role, old.approved, old.email)
     and (not public.has_role('admin') or new.id = auth.uid()) then
    raise exception 'Not allowed for your role.';
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

create function public.touch_pc() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger touch_pc before update on public.pcs
  for each row execute function public.touch_pc();

-- Reservation rules: server sets requester fields, checks dates, stamps reviews,
-- and refuses to approve anything overlapping another approved booking.
create function public.reservation_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.requester_id := auth.uid();
    new.requester_name := (select full_name from public.profiles where id = auth.uid());
    new.status := 'pending';
    new.reviewed_by := null; new.reviewed_at := null; new.admin_notes := null;
    if new.date < (now() at time zone 'Asia/Manila')::date then
      raise exception 'Date must be today or later.';
    end if;
  end if;
  if new.pc_id is not null and not exists (select 1 from public.pcs where id = new.pc_id and lab_id = new.lab_id) then
    raise exception 'That PC is not in this lab.';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if new.status = 'approved' then
    -- serialize approvals for the same lab and day so two admins can't double-book
    perform pg_advisory_xact_lock(hashtext(new.lab_id || new.date::text));
    if exists (
      select 1 from public.reservations o
      where o.id <> new.id and o.status = 'approved' and o.lab_id = new.lab_id and o.date = new.date
        and (o.pc_id is null or new.pc_id is null or o.pc_id = new.pc_id)
        and o.start_time < new.end_time and new.start_time < o.end_time
    ) then
      raise exception 'conflict' using detail = 'This slot overlaps an approved reservation.';
    end if;
  end if;
  return new;
end $$;
create trigger reservation_rules before insert or update on public.reservations
  for each row execute function public.reservation_rules();

-- ============ row level security ============
alter table public.profiles enable row level security;
alter table public.labs enable row level security;
alter table public.pcs enable row level security;
alter table public.students enable row level security;
alter table public.reservations enable row level security;
alter table public.events enable row level security;

create policy "read own or all when approved" on public.profiles for select
  using (id = auth.uid() or public.is_approved());
create policy "update own or admin" on public.profiles for update
  using ((id = auth.uid() and public.is_approved()) or public.has_role('admin'));

create policy "approved read" on public.labs for select using (public.is_approved());
create policy "admin write" on public.labs for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "approved read" on public.pcs for select using (public.is_approved());
create policy "staff update" on public.pcs for update using (public.has_role('admin', 'staff')) with check (public.has_role('admin', 'staff'));
create policy "admin insert" on public.pcs for insert with check (public.has_role('admin'));
create policy "admin delete" on public.pcs for delete using (public.has_role('admin'));

create policy "staff read" on public.students for select using (public.has_role('admin', 'staff'));
create policy "admin insert" on public.students for insert with check (public.has_role('admin'));
create policy "admin update" on public.students for update using (public.has_role('admin'));
create policy "admin delete" on public.students for delete using (public.has_role('admin'));

create policy "approved read" on public.reservations for select using (public.is_approved());
create policy "approved request" on public.reservations for insert with check (public.is_approved());
create policy "admin review" on public.reservations for update using (public.has_role('admin'));
create policy "delete own pending" on public.reservations for delete
  using (status = 'pending' and (requester_id = auth.uid() or public.has_role('admin')));

create policy "approved read" on public.events for select using (public.is_approved());
create policy "approved create" on public.events for insert with check (public.is_approved() and owner_id = auth.uid());
create policy "owner or admin update" on public.events for update using (owner_id = auth.uid() or public.has_role('admin'));
create policy "owner or admin delete" on public.events for delete using (owner_id = auth.uid() or public.has_role('admin'));

-- ============ realtime ============
alter publication supabase_realtime add table public.pcs, public.reservations;

-- ============ seed: 3 labs, 30 PCs each ============
insert into public.labs (id, name, rows, cols) values
  ('lab1', 'Computer Laboratory 1', 5, 6),
  ('lab2', 'Computer Laboratory 2', 5, 6),
  ('netlab', 'Computer Laboratory Netlab', 5, 6);

insert into public.pcs (id, lab_id, label, row, col)
select l.id || '-pc' || lpad(n::text, 2, '0'), l.id, 'PC-' || lpad(n::text, 2, '0'), (n - 1) / l.cols, (n - 1) % l.cols
from public.labs l, generate_series(1, 30) n;
