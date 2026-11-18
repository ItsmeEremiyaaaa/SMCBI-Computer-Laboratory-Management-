-- How many enrolled students each section has, for the booking form's Participants list.
-- Only counts (no names), so teachers can see them without reading the student records.
create or replace function public.section_sizes()
returns table (course text, year_level text, section text, n int)
language sql stable security definer set search_path = '' as $$
  select s.course, s.year_level, upper(s.section), count(*)::int
  from public.students s
  where s.status = 'Enrolled' and public.is_approved()
  group by 1, 2, 3
$$;
revoke all on function public.section_sizes() from public, anon;
grant execute on function public.section_sizes() to authenticated;
