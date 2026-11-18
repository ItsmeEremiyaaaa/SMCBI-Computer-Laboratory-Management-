-- An admin can create a booking on behalf of a teacher: the booking is filed under that teacher
-- (it shows in their Reservations and students see their name). Anyone else is always the requester.
-- Same as 0009's reservation_rules otherwise.
create or replace function public.reservation_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and current_setting('comlab.restoring', true) is distinct from 'on' then
    if not (public.has_role('admin') and new.requester_id is not null and exists (
      select 1 from public.profiles where id = new.requester_id and role = 'teacher' and approved
    )) then
      new.requester_id := auth.uid();
    end if;
    new.requester_name := (select full_name from public.profiles where id = new.requester_id);
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
