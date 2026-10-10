-- Phase 2.1: guest list and removing guests. Safe to re-run.
--
-- RLS can't hide a column (guests' notes) per viewer, so the guest list goes
-- through a function: the host gets everyone with notes; guests get only who's
-- Going/Maybe, without notes; anyone else gets nothing.

create or replace function public.get_guest_list(p_event_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, status text, additional_details text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, p.full_name, p.avatar_url, r.status,
         case when private.is_event_host(p_event_id) then r.additional_details end
  from public.rsvps r
  left join public.profiles p on p.id = r.user_id
  where r.event_id = p_event_id
    and (
      private.is_event_host(p_event_id)
      or (private.is_event_guest(p_event_id) and r.status in ('yes', 'maybe'))
    )
  order by p.full_name;
$$;

-- Removed guests can't rejoin through the invite link. Only reachable through
-- the functions below (RLS on, no policies).
create table if not exists public.event_removed_guests (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_removed_guests enable row level security;

-- Host removes a guest: deletes their RSVP, so they lose access to the event and chat
create or replace function public.remove_guest(p_event_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_event_host(p_event_id) then
    raise exception 'Only the host can remove guests' using errcode = '42501';
  end if;
  delete from public.rsvps where event_id = p_event_id and user_id = p_user_id;
  insert into public.event_removed_guests (event_id, user_id)
  values (p_event_id, p_user_id)
  on conflict do nothing;
  return true;
end;
$$;

-- Same as the access-control version, plus: removed guests can't rejoin
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

  if exists (
    select 1 from public.event_removed_guests
    where event_id = v_event_id and user_id = (select auth.uid())
  ) then
    raise exception 'You were removed from this event' using errcode = '42501';
  end if;

  if v_host_id <> (select auth.uid()) then
    insert into public.rsvps (event_id, user_id, status)
    values (v_event_id, (select auth.uid()), 'invited')
    on conflict (event_id, user_id) do nothing;
  end if;

  return v_event_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

revoke execute on function public.get_guest_list(uuid) from public, anon;
revoke execute on function public.remove_guest(uuid, uuid) from public, anon;
grant execute on function public.get_guest_list(uuid) to authenticated;
grant execute on function public.remove_guest(uuid, uuid) to authenticated;

-- Every event has been invite-only since the access-control migration
alter table public.events drop column if exists is_private;

notify pgrst, 'reload schema';
