-- Messages: simple one-to-one chat (e.g. a student asks the lab admin about a booking).
-- Students may write to the admin, staff and teachers (not to other students); everyone else to anyone approved.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null default auth.uid() references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  from_name text, to_name text,            -- copied in, so students never need to read the accounts table
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_to_unread on public.messages (to_id, read_at);
create index if not exists messages_from_time on public.messages (from_id, created_at);

create or replace function public.message_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; them public.profiles;
begin
  if tg_op = 'INSERT' then
    select * into me from public.profiles where id = auth.uid();
    select * into them from public.profiles where id = new.to_id;
    if me.id is null or not me.approved or me.archived_at is not null then raise exception 'Your account can''t send messages yet.' using errcode = '42501'; end if;
    if them.id is null or not them.approved or them.archived_at is not null then raise exception 'That person can''t receive messages.'; end if;
    if them.id = me.id then raise exception 'You can''t message yourself.'; end if;
    if me.role = 'student' and them.role = 'student' then raise exception 'Students can message the lab admin, staff and teachers.' using errcode = '42501'; end if;
    new.from_id := me.id; new.from_name := me.full_name; new.to_name := them.full_name;
    new.body := trim(new.body); new.created_at := now(); new.read_at := null;
    return new;
  end if;
  -- update: only the recipient, and only to mark it read
  if auth.uid() is distinct from old.to_id
     or (new.from_id, new.to_id, new.body, new.created_at, new.from_name, new.to_name)
        is distinct from (old.from_id, old.to_id, old.body, old.created_at, old.from_name, old.to_name) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.read_at := coalesce(old.read_at, new.read_at); -- the first read time is kept
  return new;
end $$;
drop trigger if exists message_rules on public.messages;
create trigger message_rules before insert or update on public.messages
  for each row execute function public.message_rules();

alter table public.messages enable row level security;
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for select using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "send" on public.messages;
create policy "send" on public.messages for insert with check (public.is_approved());
drop policy if exists "mark read" on public.messages;
create policy "mark read" on public.messages for update using (to_id = auth.uid());
drop policy if exists "delete conversation" on public.messages;
create policy "delete conversation" on public.messages for delete
  using (from_id = auth.uid() or to_id = auth.uid());

-- delete an entire conversation between me and other_id
create or replace function public.delete_conversation(other_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.messages
  where (from_id = auth.uid() and to_id = other_id)
     or (from_id = other_id and to_id = auth.uid());
$$;
revoke all on function public.delete_conversation(uuid) from public, anon;
grant execute on function public.delete_conversation(uuid) to authenticated;

-- who you may start a conversation with
create or replace function public.message_contacts()
returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.role from public.profiles p
  where public.is_approved() and p.approved and p.archived_at is null and p.id <> auth.uid()
    and (public.my_role() <> 'student' or p.role in ('admin', 'staff', 'teacher'))
  order by case p.role when 'admin' then 0 when 'staff' then 1 when 'teacher' then 2 else 3 end, p.full_name
$$;
revoke all on function public.message_contacts() from public, anon;
grant execute on function public.message_contacts() to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
end $$;
