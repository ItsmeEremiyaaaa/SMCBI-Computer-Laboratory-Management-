-- Scheduled housekeeping inside Supabase (pg_cron), so nothing depends on someone's PC being on.
-- Run once in the Supabase SQL Editor after 0006. Every 15 minutes:
--   * check-ins still open from an earlier day are closed (forgotten "Leave seat")
--   * approved bookings whose end time has passed are marked completed
create extension if not exists pg_cron;

create or replace function public.lab_housekeeping() returns void
language sql security definer set search_path = '' as $$
  update public.checkins set checked_out_at = now()
  where checked_out_at is null
    and checked_in_at < date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';

  update public.reservations set status = 'completed'
  where status = 'approved' and (date + end_time) < (now() at time zone 'Asia/Manila');
$$;
-- only the scheduler (and the SQL Editor) may run it
revoke all on function public.lab_housekeeping() from public, anon, authenticated;

select cron.schedule('comlab-housekeeping', '*/15 * * * *', 'select public.lab_housekeeping()');
