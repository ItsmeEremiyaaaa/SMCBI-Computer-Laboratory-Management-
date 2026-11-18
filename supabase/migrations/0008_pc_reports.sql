-- Problem reports: any signed-in, approved user (students included) can report a PC; staff decide.
-- A report never changes the PC by itself; staff mark it broken or dismiss it.
-- Run once in the Supabase SQL Editor after 0007.
create table public.pc_reports (
  id uuid primary key default gen_random_uuid(),
  pc_id text not null references public.pcs on delete cascade,
  lab_id text not null references public.labs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  user_name text not null default '',
  problem text not null check (char_length(trim(problem)) between 1 and 40),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('broken', 'dismissed'))
);
-- one open report per person per PC (no spamming the same problem)
create unique index pc_reports_one_open on public.pc_reports (pc_id, user_id) where resolved_at is null;
create index on public.pc_reports (lab_id) where resolved_at is null;

create function public.pc_report_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.lab_id := (select lab_id from public.pcs where id = new.pc_id);
    if new.lab_id is null then raise exception 'PC not found.'; end if;
    new.user_id := auth.uid();
    new.user_name := (select full_name from public.profiles where id = auth.uid());
    new.created_at := now();
    new.resolved_at := null;
    new.resolution := null;
  elsif (new.pc_id, new.user_id, new.problem, new.note, new.created_at)
        is distinct from (old.pc_id, old.user_id, old.problem, old.note, old.created_at) then
    raise exception 'Not allowed for your role.';  -- staff may only resolve
  end if;
  return new;
end $$;
create trigger pc_report_rules before insert or update on public.pc_reports
  for each row execute function public.pc_report_rules();

alter table public.pc_reports enable row level security;
create policy "own or staff read" on public.pc_reports for select
  using (user_id = auth.uid() or (public.is_approved() and public.my_role() in ('admin', 'staff', 'teacher')));
create policy "approved report" on public.pc_reports for insert with check (public.is_approved());
create policy "staff resolve" on public.pc_reports for update using (public.has_role('admin', 'staff'));

alter publication supabase_realtime add table public.pc_reports;
