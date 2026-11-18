-- A teacher (or staff/admin) can book a lab for a class section, e.g. 'BSIT 2B'.
-- Students of that section see the booking in their notifications.
alter table public.reservations add column if not exists section text;
alter table public.reservations add column if not exists created_at timestamptz not null default now();

-- only teachers, staff and admins may book on behalf of a section (students can't notify a whole class)
create or replace function public.reservation_section_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.section is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'staff', 'admin')
  ) then
    raise exception 'Only teachers can book for a class section.' using errcode = '42501';
  end if;
  new.section := nullif(trim(new.section), '');
  return new;
end $$;

drop trigger if exists reservation_section_guard on public.reservations;
create trigger reservation_section_guard before insert on public.reservations
  for each row execute function public.reservation_section_guard();
