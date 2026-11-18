-- Students: sex + enrollment status, and the BSIT roster (SY 2026–2027, 1st sem, as of July 9, 2026).
-- Class schedules: replace the seeded timetable with the Computer Laboratory 1/2 class schedule sheets.

alter table public.students
  add column sex text check (sex in ('Male', 'Female')),
  add column status text not null default 'Enrolled' check (status in ('Enrolled', 'Inactive', 'Dropped', 'Graduated'));

-- Placeholder records matching the official counts; IDs are C + entry year + 4 digits (C260001 …).
-- Names are placeholders to be edited on the People page. Sections are filled round-robin, ≤ ~40 each.
insert into public.students (student_id, full_name, email, course, section, year_level, sex, status)
select 'C' || y.yy || lpad(i::text, 4, '0'),
       y.lvl || ' Student ' || lpad(i::text, 3, '0'),
       'c' || y.yy || lpad(i::text, 4, '0') || '@smcbi.edu.ph',
       'BSIT',
       chr(65 + (i - 1) % ceil((y.male + y.female) / 40.0)::int),
       y.lvl,
       case when i <= y.male then 'Male' else 'Female' end,
       'Enrolled'
from (values ('26', '1st Year', 71, 20), ('25', '2nd Year', 34, 14), ('24', '3rd Year', 64, 20), ('23', '4th Year', 17, 8))
       as y(yy, lvl, male, female),
     generate_series(1, y.male + y.female) as i
on conflict do nothing;

-- Remove only the rows seeded by 0002 (anything an admin added by hand stays).
delete from public.class_schedules c
using (values
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
  ('lab2', 'BSIT 3B', 'IT Elective 2 Mobile Development', 'Rhyven Jay G. Caballero', 5, '17:00', '20:00', '2026-11-02', '2027-03-31')
) as o(lab_id, section, subject, instructor, day_of_week, start_time, end_time, starts_on, ends_on)
where c.lab_id = o.lab_id and c.section = o.section and c.subject = o.subject
  and c.day_of_week = o.day_of_week and c.start_time = o.start_time::time;

insert into public.class_schedules (lab_id, section, subject, instructor, day_of_week, start_time, end_time, starts_on, ends_on) values
  ('lab1', 'BSIT 2B', 'IT213 Information Management', 'Rhyven Jay G. Caballero', 1, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 2B', 'IT212 Data Structures & Algorithm', 'Kaye C. Bautista', 2, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BEED 2', 'EGE106 Living in the IT Era', 'Mariel Gelera', 3, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 2B', 'IT211 Web Systems & Technologies', 'John Roi Julagting', 4, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 1A', 'IT111 Introduction to Computing', 'Jhon Bryan J. Cantil, MIT', 5, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3B', 'IT312 Networking 2', 'Vince Jose Balunan', 6, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSHM 2A', 'HPC3 Applied Business Tools and Technologies', 'Kaye C. Bautista', 1, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSBA 2A', 'IT 201 Living in the IT Era', 'Mariel Gelera', 2, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSED 1', 'SGE106 Living in the IT Era', 'S. April Mariae Libradilla, RVM', 3, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSBA 2C', 'IT 201 Living in the IT Era', 'John Roi Julagting', 4, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSHM 2B', 'HPC3 Applied Business Tools and Technologies', 'Kaye C. Bautista', 5, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3A', 'IT312 Networking 2', 'Vince Jose Balunan', 6, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3A', 'IT313 Integrative Programming and Technologies 1', 'Kaye C. Bautista', 1, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSBA 2B', 'IT 201 Living in the IT Era', 'Mariel Gelera', 2, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3A', 'PerDev Social Grace and Etiquette', 'Jhon Bryan J. Cantil, MIT', 3, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSBA 2D', 'IT 201 Living in the IT Era', 'John Roi Julagting', 4, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab1', 'BSIT 3B', 'PerDev Social Grace and Etiquette', 'Jhon Bryan J. Cantil, MIT', 5, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 1B', 'IT111 Introduction to Computing', 'Jhon Bryan J. Cantil, MIT', 1, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 4', 'IT Elec4 Mobile Application Development', 'John Roi Julagting', 2, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 1A', 'IT112 Computer Programming 1', 'Rhyven Jay G. Caballero', 3, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 4', 'IT411 Capstone Project and Research 2', 'Jhon Bryan J. Cantil, MIT', 4, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 1B', 'IT112 Computer Programming 1', 'Rhyven Jay G. Caballero', 5, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT314 Information Assurance and Security 2', 'April Mae Manquiquiz', 6, '09:00', '12:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT315 System Analysis and Design', 'Rhyven Jay G. Caballero', 1, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT316 Quantitative Methods (incl. Modeling and Simulation)', 'Melanie B. Waskin, LPT', 2, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT316 Quantitative Methods (incl. Modeling and Simulation)', 'Melanie B. Waskin, LPT', 3, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT315 System Analysis and Design', 'Rhyven Jay G. Caballero', 4, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3A', 'IT311 E-Commerce', 'John Carl Ray Lelis', 5, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT314 Information Assurance and Security 2', 'April Mae Manquiquiz', 6, '13:00', '16:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT213 Information Management', 'Rhyven Jay G. Caballero', 1, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT313 Integrative Programming and Technologies 1', 'Kaye C. Bautista', 2, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT211 Web Systems & Technologies', 'John Roi Julagting', 3, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 3B', 'IT311 E-Commerce', 'John Carl Ray Lelis', 4, '17:00', '20:00', '2026-11-02', '2027-03-31'),
  ('lab2', 'BSIT 2A', 'IT212 Data Structures & Algorithm', 'Kaye C. Bautista', 5, '17:00', '20:00', '2026-11-02', '2027-03-31');
