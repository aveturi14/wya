-- Phase 1.1 / 1.2: who can see what.
-- Events are visible only to their host and invited guests; invites go
-- through RPCs; invite codes live in a host-only table; profiles are visible
-- only to people who share an event; storage writes are limited to your own
-- folder. Safe to re-run.

------------------------------------------------------------------------------
-- RSVP status: add 'invited' (created when someone accepts an invite link)
------------------------------------------------------------------------------
alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps
  add constraint rsvps_status_check check (status in ('invited', 'yes', 'no', 'maybe'));

------------------------------------------------------------------------------
-- Host setting: may guests re-share the invite link?
------------------------------------------------------------------------------
alter table public.events
  add column if not exists allow_guest_invites boolean not null default true;

------------------------------------------------------------------------------
-- Invite codes: own table, readable by the host only
------------------------------------------------------------------------------
create table if not exists public.event_invites (
  event_id uuid primary key references public.events on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at timestamptz not null default now()
);
alter table public.event_invites enable row level security;

-- Copy existing codes over, then drop the old column
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'invite_code'
  ) then
    insert into public.event_invites (event_id, code)
    select id, invite_code from public.events where invite_code is not null
    on conflict (event_id) do nothing;
    alter table public.events drop column invite_code;
  end if;
end $$;

-- Every event without a code gets one
insert into public.event_invites (event_id)
select e.id from public.events e
where not exists (select 1 from public.event_invites i where i.event_id = e.id);

create or replace function public.create_event_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_invites (event_id) values (new.id) on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_event_created on public.events;
create trigger on_event_created after insert on public.events
  for each row execute procedure public.create_event_invite();

------------------------------------------------------------------------------
-- Helper functions. They bypass RLS (security definer) so policies on
-- events and rsvps can refer to each other without infinite recursion.
-- They live in a schema the API doesn't expose, so they can't be called
-- directly over REST; signed-in users only need them for policy checks.
------------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_event_host(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events where id = p_event_id and host_id = (select auth.uid())
  );
$$;

create or replace function private.is_event_guest(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rsvps where event_id = p_event_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_chat(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_event_host(p_event_id) or exists (
    select 1 from public.rsvps
    where event_id = p_event_id and user_id = (select auth.uid()) and status in ('yes', 'maybe')
  );
$$;

-- True when the current user and p_user_id are host/guest or co-guests of an event
create or replace function private.shares_event_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where
      -- I host, they're a guest
      (e.host_id = (select auth.uid())
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = p_user_id))
      -- They host, I'm a guest
      or (e.host_id = p_user_id
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid())))
      -- We're both guests
      or (exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid()))
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = p_user_id))
  );
$$;

------------------------------------------------------------------------------
-- Invite RPCs
------------------------------------------------------------------------------

-- What the invite screen may show before login. Never the address.
create or replace function public.get_invite_preview(p_code text)
returns table (event_id uuid, title text, date timestamptz, host_name text, cover_image text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.date, p.full_name, e.cover_image
  from public.event_invites i
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = e.host_id
  where i.code = p_code;
$$;

-- Join an event from its invite link; returns the event id (null if the code is invalid)
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_host_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select e.id, e.host_id into v_event_id, v_host_id
  from public.event_invites i
  join public.events e on e.id = i.event_id
  where i.code = p_code;

  if v_event_id is null then
    return null;
  end if;

  if v_host_id <> (select auth.uid()) then
    insert into public.rsvps (event_id, user_id, status)
    values (v_event_id, (select auth.uid()), 'invited')
    on conflict (event_id, user_id) do nothing;
  end if;

  return v_event_id;
end;
$$;

-- The invite code, if the current user may share it
create or replace function public.get_invite_code(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select i.code
  from public.event_invites i
  join public.events e on e.id = i.event_id
  where i.event_id = p_event_id
    and (
      e.host_id = (select auth.uid())
      or (e.allow_guest_invites and private.is_event_guest(p_event_id))
    );
$$;

revoke execute on function private.is_event_host(uuid) from public, anon;
revoke execute on function private.is_event_guest(uuid) from public, anon;
revoke execute on function private.can_chat(uuid) from public, anon;
revoke execute on function private.shares_event_with(uuid) from public, anon;
grant execute on function private.is_event_host(uuid) to authenticated;
grant execute on function private.is_event_guest(uuid) to authenticated;
grant execute on function private.can_chat(uuid) to authenticated;
grant execute on function private.shares_event_with(uuid) to authenticated;

-- Trigger functions are never called directly
revoke execute on function public.create_event_invite() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The three invite RPCs are meant to be called by the app
revoke execute on function public.get_invite_preview(text) from public;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.get_invite_code(uuid) from public, anon;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.get_invite_code(uuid) to authenticated;

------------------------------------------------------------------------------
-- Policies: events
------------------------------------------------------------------------------
drop policy if exists "Events viewable by all" on public.events;
drop policy if exists "Events viewable by host and guests" on public.events;
create policy "Events viewable by host and guests" on public.events for select to authenticated
  using (host_id = (select auth.uid()) or private.is_event_guest(id));

------------------------------------------------------------------------------
-- Policies: event_invites (host only; guests use get_invite_code)
------------------------------------------------------------------------------
drop policy if exists "Hosts can view their invite codes" on public.event_invites;
create policy "Hosts can view their invite codes" on public.event_invites for select to authenticated
  using (private.is_event_host(event_id));

------------------------------------------------------------------------------
-- Policies: rsvps
------------------------------------------------------------------------------
drop policy if exists "RSVPs viewable by event host and self" on public.rsvps;
drop policy if exists "Users can manage own RSVPs" on public.rsvps;
drop policy if exists "Users can update own RSVPs" on public.rsvps;

create policy "RSVPs viewable by event host and self" on public.rsvps for select to authenticated
  using (user_id = (select auth.uid()) or private.is_event_host(event_id));

-- No insert policy: rows are created by accept_invite
create policy "Users can update own RSVPs" on public.rsvps for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('yes', 'no', 'maybe'));

-- Guests may change only their answer, never which event or user the row belongs to
revoke insert, update, delete on public.rsvps from anon, authenticated;
grant update (status, additional_details) on public.rsvps to authenticated;

------------------------------------------------------------------------------
-- Policies: chat_messages
------------------------------------------------------------------------------
drop policy if exists "Chat viewable by RSVP yes/maybe or host" on public.chat_messages;
drop policy if exists "Users can send messages if RSVP yes/maybe or host" on public.chat_messages;

create policy "Chat viewable by RSVP yes/maybe or host" on public.chat_messages for select to authenticated
  using (private.can_chat(event_id));
create policy "Users can send messages if RSVP yes/maybe or host" on public.chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_chat(event_id));

------------------------------------------------------------------------------
-- Policies: profiles
------------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles viewable by self and people sharing an event" on public.profiles;
create policy "Profiles viewable by self and people sharing an event" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_event_with(id));

------------------------------------------------------------------------------
-- Storage. Public buckets serve files by URL without any select policy, so
-- select is limited to your own folder (stops anyone listing every file).
------------------------------------------------------------------------------
drop policy if exists "Anyone can view event images" on storage.objects;
drop policy if exists "Authenticated users can upload event images" on storage.objects;
drop policy if exists "Users can view own event images" on storage.objects;
drop policy if exists "Users can upload own event images" on storage.objects;
drop policy if exists "Users can update own event images" on storage.objects;
drop policy if exists "Users can delete own event images" on storage.objects;

create policy "Users can view own event images" on storage.objects for select to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Users can upload own event images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] in ('covers', 'venues')
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "Users can update own event images" on storage.objects for update to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Users can delete own event images" on storage.objects for delete to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[2] = (select auth.uid())::text);

drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can view own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

create policy "Users can view own avatar" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Earlier drafts of this migration put the helpers in public
drop function if exists public.is_event_host(uuid);
drop function if exists public.is_event_guest(uuid);
drop function if exists public.can_chat(uuid);
drop function if exists public.shares_event_with(uuid);

notify pgrst, 'reload schema';
