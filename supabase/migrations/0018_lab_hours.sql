-- The labs are open 8:00 AM to 8:00 PM: new bookings and classes must fit inside those hours.
-- (Only new/edited rows are checked, so older records are left alone.)
create or replace function public.lab_hours_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('comlab.restoring', true) is distinct from 'on'
     and (new.start_time < time '08:00' or new.end_time > time '20:00') then
    raise exception 'The labs are open 8:00 AM to 8:00 PM. Pick a time inside those hours.';
  end if;
  return new;
end $$;

drop trigger if exists lab_hours_guard on public.reservations;
create trigger lab_hours_guard before insert on public.reservations
  for each row execute function public.lab_hours_guard();
drop trigger if exists lab_hours_guard on public.class_schedules;
create trigger lab_hours_guard before insert or update of start_time, end_time on public.class_schedules
  for each row execute function public.lab_hours_guard();
