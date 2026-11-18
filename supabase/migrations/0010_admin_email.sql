-- Admins change a login's email: the sign-in email (auth.users), the profile, and the matching
-- student record move together, so the account stays linked to its record.
-- Run once in the Supabase SQL Editor after 0009.
create function public.admin_update_email(profile_id uuid, new_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare old_email text; e text := lower(trim(new_email));
begin
  if not public.has_role('admin') then raise exception 'Not allowed for your role.'; end if;
  if e !~ '^[^@\s]+@smcbi\.edu\.ph$' then raise exception 'Use an @smcbi.edu.ph email.'; end if;
  select email into old_email from public.profiles where id = profile_id;
  if old_email is null then raise exception 'Account not found.'; end if;
  if lower(old_email) = e then return; end if;
  if exists (select 1 from auth.users where lower(email) = e and id <> profile_id) then
    raise exception 'Another account already uses that email.';
  end if;
  if exists (select 1 from public.students where lower(email) = e and lower(email) <> lower(old_email)) then
    raise exception 'A different student record already uses that email.';
  end if;

  -- an admin vouches for the new address, so it doesn't need a confirmation email
  update auth.users set email = e, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = profile_id;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', e), updated_at = now()
    where user_id = profile_id and provider = 'email';
  update public.profiles set email = e where id = profile_id;
  update public.students set email = e where lower(email) = lower(old_email);
end $$;

revoke all on function public.admin_update_email(uuid, text) from public, anon;
grant execute on function public.admin_update_email(uuid, text) to authenticated;
