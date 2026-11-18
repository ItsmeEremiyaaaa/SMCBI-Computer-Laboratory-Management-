-- Student accounts, booking refusals at request time, and PC check-ins (QR code on each PC).
-- Mirrors src/lib/rules.ts. Run once in the Supabase SQL Editor after 0005.

-- ============ student accounts ============
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff', 'teacher', 'student'));

-- A sign-up whose email matches an enrolled student record becomes a student right away (no approval).
-- Sign-ups that chose "student" but don't match wait for an admin, like teachers.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.students;
begin
  if new.email !~* '^[^@\s]+@smcbi\.edu\.ph$' then
    raise exception 'Use your @smcbi.edu.ph email.';
  end if;
  select * into s from public.students where lower(email) = lower(new.email) and status = 'Enrolled' limit 1;
  if s.id is not null then
    insert into public.profiles (id, full_name, email, role, approved, department, course)
    values (new.id, s.full_name, new.email, 'student', true, s.course, s.year_level || ' ' || s.section);
    return new;
  end if;
  insert into public.profiles (id, full_name, email, role, department, course)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when new.raw_user_meta_data->>'account_type' = 'student' then 'student' else 'teacher' end,
    -- ignore an unknown department instead of failing the whole sign-up
    case when new.raw_user_meta_data->>'department' in ('BSIT', 'BSBA', 'BSHM', 'BEED', 'BSED')
      then new.raw_user_meta_data->>'department' end,
    nullif(new.raw_user_meta_data->>'course', '')
  );
  return new;
end $$;

-- Students see only their own profile (not every teacher's email and phone).
drop policy "read own or all when approved" on public.profiles;
create policy "read own or all when approved" on public.profiles for select
  using (id = auth.uid() or (public.is_approved() and public.my_role() <> 'student'));

-- Students don't add calendar events.
drop policy "approved create" on public.events;
create policy "approved create" on public.events for insert
  with check (public.is_approved() and public.my_role() <> 'student' and owner_id = auth.uid());

-- ============ bookings: refuse up front ============
create or replace function public.reservation_rules() returns trigger
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
    if public.my_role() = 'student' then
      if new.lab_id <> 'netlab' then raise exception 'Students can only book the Networking Laboratory.'; end if;
      if new.pc_id is null then raise exception 'Choose the PC you will use.'; end if;
    end if;
  end if;
  if new.pc_id is not null and not exists (select 1 from public.pcs where id = new.pc_id and lab_id = new.lab_id) then
    raise exception 'That PC is not in this lab.';
  end if;
  if (tg_op = 'INSERT' or new.status = 'approved')
     and exists (select 1 from public.pcs where id = new.pc_id and status = 'broken') then
    raise exception '% is broken and can''t be booked. Pick another PC.', (select label from public.pcs where id = new.pc_id);
  end if;
  -- auth.uid() is null for the scheduled housekeeping job (0007); keep the admin who reviewed it
  if tg_op = 'UPDATE' and new.status is distinct from old.status and auth.uid() is not null then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if tg_op = 'INSERT' or new.status = 'approved' then
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

create or replace function public.reservation_vs_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.status = 'approved') and exists (
    select 1 from public.class_schedules c
    where c.lab_id = new.lab_id and c.day_of_week = extract(isodow from new.date)
      and new.date between c.starts_on and c.ends_on
      and c.start_time < new.end_time and new.start_time < c.end_time
  ) then
    raise exception 'class_conflict';
  end if;
  return new;
end $$;

-- ============ check-ins ============
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  pc_id text not null references public.pcs on delete cascade,
  lab_id text not null references public.labs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  user_name text not null default '',
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz
);
create index on public.checkins (pc_id) where checked_out_at is null;
create index on public.checkins (user_id) where checked_out_at is null;

create function public.checkin_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.pcs;
  local timestamp := now() at time zone 'Asia/Manila';
begin
  if tg_op = 'UPDATE' then
    -- only closing a check-in is allowed
    if (new.pc_id, new.user_id, new.checked_in_at) is distinct from (old.pc_id, old.user_id, old.checked_in_at) then
      raise exception 'Not allowed for your role.';
    end if;
    return new;
  end if;
  if public.my_role() is distinct from 'student' then raise exception 'Only student accounts check in to a PC.'; end if;
  select * into p from public.pcs where id = new.pc_id;
  if p.id is null then raise exception 'PC not found.'; end if;
  new.lab_id := p.lab_id;
  new.user_id := auth.uid();
  new.user_name := (select full_name from public.profiles where id = auth.uid());
  new.checked_in_at := now();
  new.checked_out_at := null;
  if p.status = 'broken' then
    raise exception '% is broken. Please use another PC and tell the lab staff.', p.label;
  end if;
  if not exists (
       select 1 from public.class_schedules c
       where c.lab_id = p.lab_id and c.day_of_week = extract(isodow from local)
         and local::date between c.starts_on and c.ends_on
         and c.start_time - interval '10 minutes' <= local::time and local::time < c.end_time)
     and not exists (
       select 1 from public.reservations r
       where r.status = 'approved' and r.requester_id = auth.uid() and r.lab_id = p.lab_id
         and (r.pc_id is null or r.pc_id = p.id) and r.date = local::date
         and r.start_time <= local::time and local::time < r.end_time) then
    raise exception 'You can only check in during a class in this lab or your approved booking.';
  end if;
  perform pg_advisory_xact_lock(hashtext('checkin' || p.id));
  if exists (select 1 from public.checkins c where c.pc_id = p.id and c.checked_out_at is null
             and c.user_id <> auth.uid() and c.checked_in_at >= date_trunc('day', local) at time zone 'Asia/Manila') then
    raise exception '% is already checked in by another student.', p.label;
  end if;
  -- one seat at a time: leave any earlier seat
  update public.checkins set checked_out_at = now() where user_id = auth.uid() and checked_out_at is null;
  return new;
end $$;
create trigger checkin_rules before insert or update on public.checkins
  for each row execute function public.checkin_rules();

alter table public.checkins enable row level security;
create policy "own or staff read" on public.checkins for select
  using (user_id = auth.uid() or (public.is_approved() and public.my_role() in ('admin', 'staff', 'teacher')));
create policy "student check in" on public.checkins for insert with check (public.is_approved());
create policy "own or admin check out" on public.checkins for update
  using (user_id = auth.uid() or public.has_role('admin', 'staff'));

alter publication supabase_realtime add table public.checkins;
