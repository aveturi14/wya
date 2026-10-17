-- Phase 8.1: invite hardening (docs/PHASE8.md §4, 8.1).
--
-- A link forwarded into an 80-person group chat shouldn't be able to flood a
-- 12-person dinner, and on pledge events every Going guest is a pledge. So:
--   * a guest limit per event (`max_guests`): "I'm in" is refused when full;
--   * invite links can expire, run out of uses, or need the host's approval;
--   * personal one-time links (for texting one person; used by 8.8).
-- A person waiting for approval has the RSVP status `requested` and is NOT a
-- guest: no event, address, guest list, chat or album until the host lets them in.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Guest limit
------------------------------------------------------------------------------
alter table public.events add column if not exists max_guests int;
alter table public.events drop constraint if exists events_max_guests_check;
alter table public.events add constraint events_max_guests_check check (max_guests is null or max_guests between 1 and 500);
-- events.address isn't selectable, so every readable column is granted one by one (see address_gating)
grant select (max_guests) on public.events to authenticated;

------------------------------------------------------------------------------
-- Link limits and approval
------------------------------------------------------------------------------
alter table public.event_invites add column if not exists expires_at timestamptz;
alter table public.event_invites add column if not exists max_uses int;
alter table public.event_invites add column if not exists uses int not null default 0;
alter table public.event_invites add column if not exists requires_approval boolean not null default false;
alter table public.event_invites drop constraint if exists event_invites_max_uses_check;
alter table public.event_invites add constraint event_invites_max_uses_check check (max_uses is null or max_uses between 1 and 10000);

-- 'requested': opened a link that needs the host's approval
alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check check (status in ('invited', 'requested', 'yes', 'no', 'maybe'));

-- One-time links. Reached only through the functions below; the host and the
-- person who made a link can see it.
create table if not exists public.event_personal_invites (
  code text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  event_id uuid not null references public.events on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  label text,
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_personal_invites_event_idx on public.event_personal_invites (event_id);
alter table public.event_personal_invites enable row level security;
revoke insert, update, delete on public.event_personal_invites from anon, authenticated;
drop policy if exists "Hosts and makers see personal invites" on public.event_personal_invites;
create policy "Hosts and makers see personal invites" on public.event_personal_invites for select to authenticated
  using (created_by = (select auth.uid()) or private.is_event_host(event_id));

------------------------------------------------------------------------------
-- 'requested' is not a guest
------------------------------------------------------------------------------
create or replace function private.is_event_guest(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rsvps
    where event_id = p_event_id and user_id = (select auth.uid()) and status <> 'requested'
  );
$$;

-- A host sees the profile of someone asking to join (to decide); the person
-- asking sees nobody's profile until they're let in
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
      -- I host, they're a guest (or asking to join)
      (e.host_id = (select auth.uid())
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = p_user_id))
      -- They host, I'm a guest
      or (e.host_id = p_user_id
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid()) and r.status <> 'requested'))
      -- We're both guests
      or (exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid()) and r.status <> 'requested')
        and exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = p_user_id and r.status <> 'requested'))
  );
$$;

create or replace function public.get_event_addresses(p_event_ids uuid[])
returns table (event_id uuid, address text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.address
  from public.events e
  where e.id = any(p_event_ids)
    and (
      e.host_id = (select auth.uid())
      or exists (
        select 1 from public.rsvps r
        where r.event_id = e.id
          and r.user_id = (select auth.uid())
          and r.status <> 'requested'
          and (e.deposit_mode <> 'pledge' or r.status in ('yes', 'maybe'))
      )
    );
$$;

-- Someone asking to join can't let themselves in (the RSVP update policy allows
-- yes/no/maybe on your own row, so this stops 'requested' -> 'yes')
create or replace function private.rsvp_join_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'requested' and new.status is distinct from old.status and old.user_id = (select auth.uid()) then
    raise exception 'The host hasn''t let you in yet.' using errcode = 'P0001', hint = 'join_pending';
  end if;
  return new;
end;
$$;
drop trigger if exists on_rsvp_join_guard on public.rsvps;
create trigger on_rsvp_join_guard before update of status on public.rsvps
  for each row execute procedure private.rsvp_join_guard();
revoke execute on function private.rsvp_join_guard() from public, anon, authenticated;

-- Guest limit: "I'm in" is refused once the event has max_guests Going.
-- Locks the event row so two people can't take the last spot at once.
create or replace function private.rsvp_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max int;
  v_going int;
begin
  if new.status <> 'yes' or old.status = 'yes' then
    return new;
  end if;
  select e.max_guests into v_max from public.events e where e.id = new.event_id for update;
  if v_max is null then
    return new;
  end if;
  select count(*) into v_going from public.rsvps r
  where r.event_id = new.event_id and r.status = 'yes' and r.user_id <> new.user_id;
  if v_going >= v_max then
    raise exception 'This event is full.' using errcode = 'P0001', hint = 'event_full';
  end if;
  return new;
end;
$$;
drop trigger if exists on_rsvp_capacity on public.rsvps;
create trigger on_rsvp_capacity before update of status on public.rsvps
  for each row execute procedure private.rsvp_capacity();
revoke execute on function private.rsvp_capacity() from public, anon, authenticated;

------------------------------------------------------------------------------
-- Notifications: 'join_requested' (to the host), 'join_approved' (to the guest)
------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added',
  'join_requested', 'join_approved'
));

create or replace function private.notify_rsvp_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = new.event_id;
  if v_event.id is null or v_event.host_id = new.user_id then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    values (v_event.host_id, case when new.status = 'requested' then 'join_requested' else 'joined' end, v_event.id, new.user_id,
            jsonb_build_object('title', v_event.title, 'actor_name', (select full_name from public.profiles where id = new.user_id)));
  elsif new.status is distinct from old.status and new.status in ('yes', 'maybe', 'no') then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    values (v_event.host_id, 'rsvp', v_event.id, new.user_id,
            jsonb_build_object('title', v_event.title, 'status', new.status, 'actor_name', (select full_name from public.profiles where id = new.user_id)));
  end if;
  return new;
end;
$$;

-- People still asking to join don't hear about changes or cancellations
create or replace function private.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes text[] := '{}';
begin
  if tg_op = 'DELETE' then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select r.user_id, 'event_cancelled', old.id, old.host_id,
           jsonb_build_object('title', old.title, 'actor_name', (select full_name from public.profiles where id = old.host_id))
    from public.rsvps r where r.event_id = old.id and r.status not in ('no', 'requested');
    return old;
  end if;

  if new.date is distinct from old.date or new.end_date is distinct from old.end_date then v_changes := array_append(v_changes, 'time'); end if;
  if new.address is distinct from old.address or new.venue_name is distinct from old.venue_name then v_changes := array_append(v_changes, 'place'); end if;
  if new.title is distinct from old.title then v_changes := array_append(v_changes, 'name'); end if;

  if array_length(v_changes, 1) > 0 then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select r.user_id, 'event_updated', new.id, new.host_id,
           jsonb_build_object('title', new.title, 'changes', to_jsonb(v_changes), 'actor_name', (select full_name from public.profiles where id = new.host_id))
    from public.rsvps r where r.event_id = new.id and r.status not in ('no', 'requested');
  end if;
  return new;
end;
$$;

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
create or replace function public.set_invite_limits(
  p_event_id uuid, p_expires_at timestamptz, p_max_uses int, p_requires_approval boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_event_host(p_event_id) then
    raise exception 'Only the host can change the invite link' using errcode = '42501';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 10000) then
    raise exception 'Uses must be between 1 and 10,000' using errcode = '22023';
  end if;
  update public.event_invites
  set expires_at = p_expires_at, max_uses = p_max_uses, requires_approval = coalesce(p_requires_approval, false)
  where event_id = p_event_id;
end;
$$;

-- Accepting an invite. Limits apply only to people joining for the first time:
-- someone already on the event can always reopen the link.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.event_invites%rowtype;
  v_personal public.event_personal_invites%rowtype;
  v_event public.events%rowtype;
  v_status text := 'invited';
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Row locks: two people can't both take the last use of a link
  select * into v_invite from public.event_invites where code = p_code for update;
  if v_invite.event_id is null then
    select * into v_personal from public.event_personal_invites where code = p_code for update;
    if v_personal.event_id is null then
      return null;
    end if;
  end if;
  select * into v_event from public.events where id = coalesce(v_invite.event_id, v_personal.event_id);

  if exists (select 1 from public.event_removed_guests where event_id = v_event.id and user_id = v_uid) then
    raise exception 'You were removed from this event' using errcode = '42501';
  end if;
  if v_event.host_id = v_uid
     or exists (select 1 from public.rsvps where event_id = v_event.id and user_id = v_uid) then
    return v_event.id;
  end if;

  if v_personal.code is not null then
    if v_personal.used_by is not null and v_personal.used_by <> v_uid then
      raise exception 'This one-time link has already been used.' using errcode = 'P0001', hint = 'invite_used_up';
    end if;
    update public.event_personal_invites set used_by = v_uid, used_at = now() where code = v_personal.code;
  else
    if v_invite.expires_at is not null and now() >= v_invite.expires_at then
      raise exception 'This invite link has expired. Ask the host for a new one.' using errcode = 'P0001', hint = 'invite_expired';
    end if;
    if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
      raise exception 'This invite link has been used as many times as the host allowed.' using errcode = 'P0001', hint = 'invite_used_up';
    end if;
    update public.event_invites set uses = uses + 1 where event_id = v_invite.event_id;
    if v_invite.requires_approval then
      v_status := 'requested';
    end if;
  end if;

  insert into public.rsvps (event_id, user_id, status)
  values (v_event.id, v_uid, v_status)
  on conflict (event_id, user_id) do nothing;
  return v_event.id;
end;
$$;

-- The invite page, before login: also says whether the link still works and
-- whether the host approves joins. Never the address.
drop function if exists public.get_invite_preview(text);
create function public.get_invite_preview(p_code text)
returns table (event_id uuid, title text, date timestamptz, host_name text, cover_image text, theme text,
               requires_approval boolean, link_status text)
language sql
stable
security definer
set search_path = ''
as $$
  with link as (
    select i.event_id, i.requires_approval,
           case when i.expires_at is not null and now() >= i.expires_at then 'expired'
                when i.max_uses is not null and i.uses >= i.max_uses then 'used_up'
                else 'open' end as link_status
    from public.event_invites i where i.code = p_code
    union all
    select pi.event_id, false,
           case when pi.used_by is not null and pi.used_by is distinct from (select auth.uid()) then 'used_up' else 'open' end
    from public.event_personal_invites pi where pi.code = p_code
  )
  select e.id, e.title, e.date, p.full_name, e.cover_image, e.theme, l.requires_approval, l.link_status
  from link l
  join public.events e on e.id = l.event_id
  left join public.profiles p on p.id = e.host_id;
$$;
revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

create or replace function public.approve_join(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  if (select auth.uid()) is null or not private.is_event_host(p_event_id) then
    raise exception 'Only the host can let people in' using errcode = '42501';
  end if;
  update public.rsvps set status = 'invited'
  where event_id = p_event_id and user_id = p_user_id and status = 'requested';
  if not found then
    raise exception 'That person isn''t asking to join' using errcode = 'P0001';
  end if;
  select * into v_event from public.events where id = p_event_id;
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  values (p_user_id, 'join_approved', p_event_id, v_event.host_id,
          jsonb_build_object('title', v_event.title, 'actor_name', (select full_name from public.profiles where id = v_event.host_id)));
end;
$$;

-- Declining works like removing: they can't ask again with the same link
create or replace function public.decline_join(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_event_host(p_event_id) then
    raise exception 'Only the host can decline requests' using errcode = '42501';
  end if;
  delete from public.rsvps where event_id = p_event_id and user_id = p_user_id and status = 'requested';
  if not found then
    raise exception 'That person isn''t asking to join' using errcode = 'P0001';
  end if;
  insert into public.event_removed_guests (event_id, user_id) values (p_event_id, p_user_id) on conflict do nothing;
end;
$$;

-- A one-time link for one person: the host, or a guest while re-sharing is on (INV-3)
create or replace function public.create_personal_invite(p_event_id uuid, p_label text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not (
    private.is_event_host(p_event_id)
    or (private.is_event_guest(p_event_id)
        and exists (select 1 from public.events e where e.id = p_event_id and e.allow_guest_invites))
  ) then
    raise exception 'You can''t invite people to this event' using errcode = '42501';
  end if;
  perform private.hit_rate_limit('personal_invite:' || v_uid, 50, interval '1 day');
  insert into public.event_personal_invites (event_id, created_by, label)
  values (p_event_id, v_uid, nullif(left(btrim(coalesce(p_label, '')), 40), ''))
  returning code into v_code;
  return v_code;
end;
$$;

revoke execute on function public.set_invite_limits(uuid, timestamptz, int, boolean) from public, anon;
revoke execute on function public.approve_join(uuid, uuid) from public, anon;
revoke execute on function public.decline_join(uuid, uuid) from public, anon;
revoke execute on function public.create_personal_invite(uuid, text) from public, anon;
grant execute on function public.set_invite_limits(uuid, timestamptz, int, boolean) to authenticated;
grant execute on function public.approve_join(uuid, uuid) to authenticated;
grant execute on function public.decline_join(uuid, uuid) to authenticated;
grant execute on function public.create_personal_invite(uuid, text) to authenticated;

notify pgrst, 'reload schema';
