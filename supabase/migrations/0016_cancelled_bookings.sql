-- An admin can cancel a booking that was already approved (e.g. maintenance). The slot opens up
-- again (clash checks only look at approved bookings) and the requester/section is notified.
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled'));
