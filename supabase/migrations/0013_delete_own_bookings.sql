-- Requesters may also remove their own rejected or completed bookings (not approved ones: that would
-- silently free a slot the admin set aside). Same as 0009's archive_row otherwise.
create or replace function public.archive_row(kind text, row_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare t text := public.archive_table(kind); d jsonb;
begin
  if t is null then raise exception 'Unknown kind.'; end if;
  execute format('select to_jsonb(x) from public.%I x where x.id::text = $1', t) into d using row_id;
  if d is null then raise exception 'Not found.'; end if;
  if not public.has_role('admin') and not (
       (kind = 'reservation' and d->>'requester_id' = auth.uid()::text and d->>'status' in ('pending', 'rejected', 'completed'))
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
