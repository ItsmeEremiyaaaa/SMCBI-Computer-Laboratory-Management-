-- Archive instead of delete. Run once in the Supabase SQL Editor after 0008.
--  * Student records, bookings, calendar events and classes: "Delete" moves the row into public.archive
--    (so every list, count and clash check ignores it with no other changes) and Restore puts it back.
--  * Accounts: archived logins keep their row but lose all access (my_role() ignores them).

-- ============ accounts ============
alter table public.profiles add column archived_at timestamptz;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and approved and archived_at is null
$$;

-- ============ archived rows ============
create table public.archive (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student', 'reservation', 'event', 'class')),
  row_id text not null,
  label text not null,
  data jsonb not null,
  archived_by uuid references public.profiles on delete set null,
  archived_by_name text,
  archived_at timestamptz not null default now()
);
alter table public.archive enable row level security;
create policy "admin read" on public.archive for select using (public.has_role('admin'));
create policy "admin purge" on public.archive for delete using (public.has_role('admin'));

create function public.archive_table(kind text) returns text
language sql immutable as $$
  select case kind when 'student' then 'students' when 'reservation' then 'reservations'
                   when 'event' then 'events' when 'class' then 'class_schedules' end
$$;

-- Admins archive anything; a requester may archive their own pending request; an owner their own event.
create function public.archive_row(kind text, row_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare t text := public.archive_table(kind); d jsonb;
begin
  if t is null then raise exception 'Unknown kind.'; end if;
  execute format('select to_jsonb(x) from public.%I x where x.id::text = $1', t) into d using row_id;
  if d is null then raise exception 'Not found.'; end if;
  if not public.has_role('admin') and not (
       (kind = 'reservation' and d->>'requester_id' = auth.uid()::text and d->>'status' = 'pending')
    or (kind = 'event' and d->>'owner_id' = auth.uid()::text and public.is_approved())) then
    raise exception 'Not allowed for your role.';
  end if;
  insert into public.archive (kind, row_id, label, data, archived_by, archived_by_name)
  values (kind, row_id,
    case kind when 'student' then concat(d->>'student_id', ' · ', d->>'full_name')
              when 'reservation' then concat(d->>'title', ' · ', d->>'date', ' ', left(d->>'start_time', 5))
              when 'event' then concat(d->>'title', ' · ', d->>'event_date')
              else concat(d->>'section', ' · ', d->>'subject') end,
    d, auth.uid(), (select full_name from public.profiles where id = auth.uid()));
  execute format('delete from public.%I where id::text = $1', t) using row_id;
end $$;

-- Puts an archived row back exactly as it was (clash rules still apply, so a restore can be refused).
create function public.restore_row(archive_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.archive; t text;
begin
  if not public.has_role('admin') then raise exception 'Not allowed for your role.'; end if;
  select * into a from public.archive where id = archive_id;
  if a.id is null then raise exception 'Not found.'; end if;
  t := public.archive_table(a.kind);
  perform set_config('comlab.restoring', 'on', true);  -- keep the original requester/status (see reservation_rules)
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', t, t) using a.data;
  perform set_config('comlab.restoring', 'off', true);
  delete from public.archive where id = archive_id;
end $$;

revoke all on function public.archive_row(text, text) from public, anon;
revoke all on function public.restore_row(uuid) from public, anon;
grant execute on function public.archive_row(text, text) to authenticated;
grant execute on function public.restore_row(uuid) to authenticated;

-- Same as 0006, except a restored booking keeps its original requester, status and dates.
create or replace function public.reservation_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and current_setting('comlab.restoring', true) is distinct from 'on' then
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
  if (tg_op = 'INSERT' and new.status in ('pending', 'approved') or new.status = 'approved')
     and exists (select 1 from public.pcs where id = new.pc_id and status = 'broken') then
    raise exception '% is broken and can''t be booked. Pick another PC.', (select label from public.pcs where id = new.pc_id);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and auth.uid() is not null then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if (tg_op = 'INSERT' and new.status in ('pending', 'approved')) or new.status = 'approved' then
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

-- Restoring a past or finished booking must not trip the "clashes with a class" rule for history.
create or replace function public.reservation_vs_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if ((tg_op = 'INSERT' and current_setting('comlab.restoring', true) is distinct from 'on') or new.status = 'approved') and exists (
    select 1 from public.class_schedules c
    where c.lab_id = new.lab_id and c.day_of_week = extract(isodow from new.date)
      and new.date between c.starts_on and c.ends_on
      and c.start_time < new.end_time and new.start_time < c.end_time
  ) then
    raise exception 'class_conflict';
  end if;
  return new;
end $$;
