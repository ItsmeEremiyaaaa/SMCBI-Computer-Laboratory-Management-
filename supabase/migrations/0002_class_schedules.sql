-- Weekly lab classes (AY 2026–2027 2nd semester). Run in the Supabase SQL Editor after 0001.

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  lab_id text not null references public.labs on delete cascade,
  section text not null check (char_length(trim(section)) > 0),
  subject text not null check (char_length(trim(subject)) > 0),
  instructor text not null default '',
  day_of_week int not null check (day_of_week between 1 and 7), -- 1 = Monday
  start_time time not null,
  end_time time not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (ends_on >= starts_on)
);
create index on public.class_schedules (lab_id, day_of_week);

alter table public.class_schedules enable row level security;
create policy "approved read" on public.class_schedules for select using (public.is_approved());
create policy "admin insert" on public.class_schedules for insert with check (public.has_role('admin'));
create policy "admin update" on public.class_schedules for update using (public.has_role('admin'));
create policy "admin delete" on public.class_schedules for delete using (public.has_role('admin'));

-- No two classes in the same lab at the same time.
create function public.class_schedule_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('class:' || new.lab_id));
  if exists (
    select 1 from public.class_schedules o
    where o.id <> new.id and o.lab_id = new.lab_id and o.day_of_week = new.day_of_week
      and o.start_time < new.end_time and new.start_time < o.end_time
      and o.starts_on <= new.ends_on and new.starts_on <= o.ends_on
  ) then
    raise exception 'schedule_conflict';
  end if;
  return new;
end $$;
create trigger class_schedule_rules before insert or update on public.class_schedules
  for each row execute function public.class_schedule_rules();

-- Bookings can't be approved over a regular class.
create function public.reservation_vs_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and exists (
    select 1 from public.class_schedules c
    where c.lab_id = new.lab_id and c.day_of_week = extract(isodow from new.date)
      and new.date between c.starts_on and c.ends_on
      and c.start_time < new.end_time and new.start_time < c.end_time
  ) then
    raise exception 'class_conflict';
  end if;
  return new;
end $$;
create trigger reservation_vs_classes before insert or update on public.reservations
  for each row execute function public.reservation_vs_classes();

alter publication supabase_realtime add table public.class_schedules;

-- Seed: the 23 lab classes from the BSIT 1A/1B/2A/3A/3B schedule sheets.
insert into public.class_schedules (lab_id, section, subject, instructor, day_of_week, start_time, end_time, starts_on, ends_on) values
  ('lab2', 'BSIT 1A', 'IT123 Multimedia Systems', 'John Roi Julagting', 1, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 1B', 'IT121 Computer Programming 2', 'Rhyven Jay G. Caballero', 1, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT322 Capstone Project and Research 1', 'Jhon Bryan J. Cantil', 1, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3B', 'IT401 Systems Administration and Maintenance', 'John Roi Julagting', 1, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT321 System Integration and Architecture 1', 'Kaye C. Bautista', 1, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3B', 'IT402 Computer Graphics and Animation', 'Rhyven Jay G. Caballero', 1, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT224 Applications Development & Emerging Technologies', 'Kaye C. Bautista', 2, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT223 Advanced Database Systems', 'Rhyven Jay G. Caballero', 2, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT221 Information Assurance and Security 1', 'John Roi Julagting', 2, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 1A', 'IT121 Computer Programming 2', 'Rhyven Jay G. Caballero', 3, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 1B', 'IT122 Introduction to Human Computer Interaction', 'Kaye C. Bautista', 3, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3A', 'IT401 Systems Administration and Maintenance', 'John Roi Julagting', 3, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT322 Capstone Project and Research 1', 'Jhon Bryan J. Cantil', 3, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT Elective 2 Mobile Development', 'Rhyven Jay G. Caballero', 3, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('netlab', 'BSIT 3B', 'IT323 Social and Professional Issues', 'Jhon Bryan J. Cantil', 3, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT226 Object Oriented Programming', 'Kaye C. Bautista', 4, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 2A', 'IT222 Data Communications and Networking 1', 'S. April Mariae Libradilla', 4, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 1A', 'IT122 Introduction to Human Computer Interaction', 'Kaye C. Bautista', 5, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 1B', 'IT123 Multimedia Systems', 'John Roi Julagting', 5, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT402 Computer Graphics and Animation', 'Rhyven Jay G. Caballero', 5, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3B', 'IT321 System Integration and Architecture 1', 'Kaye C. Bautista', 5, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3A', 'IT323 Social and Professional Issues', 'Jhon Bryan J. Cantil', 5, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT Elective 2 Mobile Development', 'Rhyven Jay G. Caballero', 5, '17:00', '20:00', '2026-11-02', '2027-03-31');
