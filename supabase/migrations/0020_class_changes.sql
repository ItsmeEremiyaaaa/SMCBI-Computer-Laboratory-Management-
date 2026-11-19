-- One-day changes to a weekly class: cancelled, activity only (no lab), or moved to another date/time/lab.
-- The weekly schedule itself is untouched; next week runs as normal.
create table if not exists public.class_changes (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.class_schedules on delete cascade,
  date date not null,                       -- the meeting that changes
  kind text not null check (kind in ('cancelled', 'activity', 'moved')),
  new_date date, new_start time, new_end time,
  new_lab text references public.labs on delete cascade,
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (schedule_id, date),
  check (kind <> 'moved' or (new_date is not null and new_start is not null and new_end is not null and new_lab is not null and new_end > new_start))
);

-- The class meetings that really happen on a date: regular meetings without a change, plus meetings moved into it.
create or replace function public.class_sessions(d date)
returns table (schedule_id uuid, lab_id text, start_time time, end_time time, label text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.lab_id, c.start_time, c.end_time, c.section || ' ' || c.subject
  from public.class_schedules c
  where c.day_of_week = extract(isodow from d) and d between c.starts_on and c.ends_on
    and not exists (select 1 from public.class_changes x where x.schedule_id = c.id and x.date = d)
  union all
  select c.id, x.new_lab, x.new_start, x.new_end, c.section || ' ' || c.subject
  from public.class_changes x join public.class_schedules c on c.id = x.schedule_id
  where x.kind = 'moved' and x.new_date = d
$$;

-- Bookings vs classes now respects changes: a cancelled class frees its slot, a moved one blocks its new slot.
create or replace function public.reservation_vs_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if ((tg_op = 'INSERT' and current_setting('comlab.restoring', true) is distinct from 'on') or new.status = 'approved') and exists (
    select 1 from public.class_sessions(new.date) s
    where s.lab_id = new.lab_id and s.start_time < new.end_time and new.start_time < s.end_time
  ) then
    raise exception 'class_conflict';
  end if;
  return new;
end $$;

-- Who may change a class, and refuse moves that clash (fail fast with a clear reason).
create or replace function public.class_change_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.class_schedules; me public.profiles; clash text;
begin
  select * into c from public.class_schedules where id = new.schedule_id;
  select * into me from public.profiles where id = auth.uid();
  if c.id is null then raise exception 'Class not found.'; end if;
  if not (me.role in ('admin', 'staff') or (me.role = 'teacher' and me.approved and lower(trim(me.full_name)) = lower(trim(c.instructor)))) then
    raise exception 'Only the admin, staff or this class''s teacher can change it.' using errcode = '42501';
  end if;
  if new.date < (now() at time zone 'Asia/Manila')::date then raise exception 'That class meeting has already passed.'; end if;
  if not (c.day_of_week = extract(isodow from new.date) and new.date between c.starts_on and c.ends_on) then
    raise exception 'This class doesn''t meet on that date.';
  end if;
  new.created_by := auth.uid();
  new.created_by_name := me.full_name;
  if new.kind <> 'moved' then
    new.new_date := null; new.new_start := null; new.new_end := null; new.new_lab := null;
    return new;
  end if;
  if new.new_date < (now() at time zone 'Asia/Manila')::date then raise exception 'Pick a date that hasn''t passed.'; end if;
  if new.new_start < time '08:00' or new.new_end > time '20:00' then
    raise exception 'The labs are open 8:00 AM to 8:00 PM. Pick a time inside those hours.';
  end if;
  -- another class in that lab at that time (ignoring this class's own meeting that is being moved)
  select s.label into clash from public.class_sessions(new.new_date) s
   where s.lab_id = new.new_lab and s.start_time < new.new_end and new.new_start < s.end_time
     and not (s.schedule_id = new.schedule_id)
   limit 1;
  if clash is not null then raise exception 'Can''t move it there: it clashes with % in that lab.', clash; end if;
  select r.title into clash from public.reservations r
   where r.status = 'approved' and r.lab_id = new.new_lab and r.date = new.new_date
     and r.start_time < new.new_end and new.new_start < r.end_time
   limit 1;
  if clash is not null then raise exception 'Can''t move it there: it clashes with the approved booking "%".', clash; end if;
  return new;
end $$;
drop trigger if exists class_change_rules on public.class_changes;
create trigger class_change_rules before insert or update on public.class_changes
  for each row execute function public.class_change_rules();

alter table public.class_changes enable row level security;
drop policy if exists "approved read" on public.class_changes;
create policy "approved read" on public.class_changes for select using (public.is_approved());
drop policy if exists "change own class" on public.class_changes;
create policy "change own class" on public.class_changes for all
  using (public.has_role('admin', 'staff') or exists (
    select 1 from public.class_schedules c join public.profiles p on p.id = auth.uid()
    where c.id = schedule_id and p.role = 'teacher' and lower(trim(p.full_name)) = lower(trim(c.instructor))))
  with check (true); -- the trigger above checks inserts/updates with clear messages

do $$ begin
  begin alter publication supabase_realtime add table public.class_changes; exception when duplicate_object then null; end;
end $$;
