-- Phase 8.8: home agent v1, no model yet (docs/PHASE8.md §4, 8.8).
--
-- The propose-and-approve machinery the assistant (8.11) will drive later, usable
-- from buttons today:
--   * get_recent_people: people you've actually been to events with;
--   * circles: your own labelled groups of them (private to you);
--   * agent_actions: proposals ("invite these 4 people", "share the link to
--     WhatsApp") that do nothing until their owner approves them;
--   * agent_grants: per-person switches for what the assistant may use;
--   * host_mutes: stop a host's direct invites (they just see "unavailable").
-- Direct invites (AGT-1) go only to people you share an event with, are rate
-- limited, and never reach someone removed from the event or who muted you.
-- Anything sent outside wya (WhatsApp, SMS) is sent by the person from their
-- own phone; the database only returns the text and the link.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table if not exists public.circle_members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
revoke insert, update, delete on public.circles, public.circle_members from anon, authenticated;
-- Members can't see the circles they're filed under
drop policy if exists "Owners see their circles" on public.circles;
create policy "Owners see their circles" on public.circles for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Owners see their circle members" on public.circle_members;
create policy "Owners see their circle members" on public.circle_members for select to authenticated
  using (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = (select auth.uid())));

create table if not exists public.agent_grants (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  capability text not null check (capability in ('suggest_people', 'use_contacts', 'draft_messages')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, capability)
);
alter table public.agent_grants enable row level security;
revoke insert, update, delete on public.agent_grants from anon, authenticated;
drop policy if exists "Users see their own switches" on public.agent_grants;
create policy "Users see their own switches" on public.agent_grants for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.host_mutes (
  user_id uuid not null references auth.users on delete cascade,
  host_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, host_id)
);
alter table public.host_mutes enable row level security;
revoke insert, update, delete on public.host_mutes from anon, authenticated;
drop policy if exists "Users see who they muted" on public.host_mutes;
create policy "Users see who they muted" on public.host_mutes for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('invite_people', 'send_reminder', 'share_link')),
  event_id uuid not null references public.events on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'executed', 'cancelled', 'expired', 'failed')),
  source text not null default 'user' check (source in ('user', 'suggestion', 'assistant')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  executed_at timestamptz,
  result jsonb
);
create index if not exists agent_actions_user_idx on public.agent_actions (user_id, created_at desc);
alter table public.agent_actions enable row level security;
revoke insert, update, delete on public.agent_actions from anon, authenticated;
drop policy if exists "Users see their own proposals" on public.agent_actions;
create policy "Users see their own proposals" on public.agent_actions for select to authenticated using (user_id = (select auth.uid()));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added',
  'join_requested', 'join_approved',
  'split_owed',
  'rsvp_reminder', 'excuse_prompt',
  'event_locked',
  'direct_invite'
));

-- A direct invite inserts an RSVP, which would also tell the host "Gary opened
-- your invite". approve_action sets wya.direct_invite for its transaction so
-- that notification is skipped (the invitee gets 'direct_invite' instead).
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
    if coalesce(current_setting('wya.direct_invite', true), '') = 'on' then
      return new;
    end if;
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

------------------------------------------------------------------------------
-- People and circles
------------------------------------------------------------------------------
-- People who were at past events with you: both of you the host or Going
create or replace function public.get_recent_people(p_limit int default 30)
returns table (user_id uuid, full_name text, avatar_url text, events_together int, last_together timestamptz)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select e.id, e.date from public.events e
    where e.date < now()
      and (e.host_id = (select auth.uid())
           or exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid()) and r.status = 'yes'))
  ),
  them as (
    select m.id, m.date, e.host_id as person from mine m join public.events e on e.id = m.id
    union
    select m.id, m.date, r.user_id from mine m join public.rsvps r on r.event_id = m.id and r.status = 'yes'
  )
  select t.person, p.full_name, p.avatar_url, count(distinct t.id)::int, max(t.date)
  from them t
  left join public.profiles p on p.id = t.person
  where t.person <> (select auth.uid())
  group by t.person, p.full_name, p.avatar_url
  order by max(t.date) desc, count(distinct t.id) desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.create_circle(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'Give the circle a name (up to 40 characters)' using errcode = '22023';
  end if;
  insert into public.circles (owner_id, name) values ((select auth.uid()), btrim(p_name)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_circle(p_circle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.circles where id = p_circle_id and owner_id = (select auth.uid());
end;
$$;

create or replace function public.add_circle_member(p_circle_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circles where id = p_circle_id and owner_id = (select auth.uid())) then
    raise exception 'Circle not found' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) or not private.shares_event_with(p_user_id) then
    raise exception 'You can only add people you''ve shared an event with' using errcode = '42501';
  end if;
  insert into public.circle_members (circle_id, user_id) values (p_circle_id, p_user_id) on conflict do nothing;
end;
$$;

create or replace function public.remove_circle_member(p_circle_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.circle_members m
  using public.circles c
  where m.circle_id = p_circle_id and m.user_id = p_user_id and c.id = m.circle_id and c.owner_id = (select auth.uid());
end;
$$;

create or replace function public.set_agent_grant(p_capability text, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_capability not in ('suggest_people', 'use_contacts', 'draft_messages') then
    raise exception 'Unknown setting' using errcode = '22023';
  end if;
  insert into public.agent_grants (user_id, capability, enabled, updated_at)
  values ((select auth.uid()), p_capability, coalesce(p_enabled, false), now())
  on conflict (user_id, capability) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

create or replace function public.mute_host(p_host_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  insert into public.host_mutes (user_id, host_id) values ((select auth.uid()), p_host_id) on conflict do nothing;
end;
$$;

create or replace function public.unmute_host(p_host_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.host_mutes where user_id = (select auth.uid()) and host_id = p_host_id;
end;
$$;

------------------------------------------------------------------------------
-- Proposals
------------------------------------------------------------------------------
-- Checks the shape only; never runs anything
create or replace function public.propose_action(
  p_kind text, p_event_id uuid, p_payload jsonb, p_ttl_seconds int default 86400
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_kind not in ('invite_people', 'send_reminder', 'share_link') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds not between 1 and 86400 then
    raise exception 'A proposal lasts between 1 second and 24 hours' using errcode = '22023';
  end if;
  if not (private.is_event_host(p_event_id) or private.is_event_guest(p_event_id)) then
    raise exception 'Event not found' using errcode = '42501';
  end if;
  if p_kind = 'invite_people' and (
       jsonb_typeof(p_payload->'user_ids') <> 'array'
       or jsonb_array_length(p_payload->'user_ids') not between 1 and 50) then
    raise exception 'Pick between 1 and 50 people' using errcode = '22023';
  end if;
  if p_kind = 'share_link' and coalesce(p_payload->>'channel', '') not in ('whatsapp', 'sms', 'other') then
    raise exception 'Share to WhatsApp, a text message, or somewhere else' using errcode = '22023';
  end if;
  insert into public.agent_actions (user_id, kind, event_id, payload, expires_at, source)
  values ((select auth.uid()), p_kind, p_event_id, coalesce(p_payload, '{}'::jsonb),
          now() + make_interval(secs => p_ttl_seconds), 'user')
  returning id into v_id;
  return v_id;
end;
$$;

-- Runs a proposal, re-checking everything now. invite_people returns
-- {invited: [...], skipped: [{user_id, reason}]}; share_link returns {text, url}
-- for the phone's share sheet and stays 'approved' until mark_action_executed.
create or replace function public.approve_action(p_action_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_action public.agent_actions%rowtype;
  v_event public.events%rowtype;
  v_person uuid;
  v_invited uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_result jsonb;
  v_code text;
  v_name text;
begin
  select * into v_action from public.agent_actions where id = p_action_id and user_id = v_uid for update;
  if v_action.id is null then
    raise exception 'Not found' using errcode = '42501';
  end if;
  if v_action.status <> 'proposed' then
    raise exception 'This has already been handled' using errcode = 'P0001', hint = 'already_handled';
  end if;
  if now() > v_action.expires_at then
    raise exception 'This suggestion has expired' using errcode = 'P0001', hint = 'expired';
  end if;
  select * into v_event from public.events where id = v_action.event_id;
  v_name := (select full_name from public.profiles where id = v_uid);

  if v_action.kind = 'invite_people' then
    if not (v_event.host_id = v_uid or (v_event.allow_guest_invites and private.is_event_guest(v_event.id))) then
      raise exception 'Only the host can invite people to this event' using errcode = '42501';
    end if;
    perform set_config('wya.direct_invite', 'on', true);
    for v_person in select (jsonb_array_elements_text(v_action.payload->'user_ids'))::uuid loop
      if v_person = v_uid or v_person = v_event.host_id
         or exists (select 1 from public.rsvps where event_id = v_event.id and user_id = v_person) then
        v_skipped := v_skipped || jsonb_build_object('user_id', v_person, 'reason', 'already_on');
      elsif exists (select 1 from public.event_removed_guests where event_id = v_event.id and user_id = v_person) then
        v_skipped := v_skipped || jsonb_build_object('user_id', v_person, 'reason', 'removed');
      elsif exists (select 1 from public.host_mutes where user_id = v_person and host_id = v_uid) then
        -- Reported like any other "can't", so the mute stays private
        v_skipped := v_skipped || jsonb_build_object('user_id', v_person, 'reason', 'unavailable');
      elsif not private.shares_event_with(v_person) then
        v_skipped := v_skipped || jsonb_build_object('user_id', v_person, 'reason', 'not_connected');
      else
        perform private.hit_rate_limit('direct_invite:' || v_uid, 50, interval '1 day');
        insert into public.rsvps (event_id, user_id, status) values (v_event.id, v_person, 'invited');
        insert into public.notifications (user_id, type, event_id, actor_id, data)
        values (v_person, 'direct_invite', v_event.id, v_uid,
                jsonb_build_object('title', v_event.title, 'actor_name', v_name));
        v_invited := array_append(v_invited, v_person);
      end if;
    end loop;
    perform set_config('wya.direct_invite', '', true);
    v_result := jsonb_build_object('invited', to_jsonb(v_invited), 'skipped', v_skipped);
    update public.agent_actions set status = 'executed', decided_at = now(), executed_at = now(), result = v_result where id = v_action.id;

  elsif v_action.kind = 'send_reminder' then
    v_result := jsonb_build_object('reminded', public.remind_unanswered(v_event.id));
    update public.agent_actions set status = 'executed', decided_at = now(), executed_at = now(), result = v_result where id = v_action.id;

  else
    -- share_link: the same rules as get_invite_code; the app adds its web address to `url`
    v_code := public.get_invite_code(v_event.id);
    if v_code is null then
      raise exception 'Only the host can share the link for this event' using errcode = '42501';
    end if;
    v_result := jsonb_build_object(
      'url', '/invite/' || v_code,
      'text', coalesce(split_part(v_name, ' ', 1), 'Someone') || ' invited you to ' || v_event.title,
      'channel', v_action.payload->>'channel');
    update public.agent_actions set status = 'approved', decided_at = now(), result = v_result where id = v_action.id;
  end if;
  return v_result;
end;
$$;

create or replace function public.cancel_action(p_action_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.agent_actions set status = 'cancelled', decided_at = now()
  where id = p_action_id and user_id = (select auth.uid()) and status in ('proposed', 'approved');
end;
$$;

-- After the share sheet closes (wya can't confirm the message was actually sent)
create or replace function public.mark_action_executed(p_action_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.agent_actions set status = 'executed', executed_at = now()
  where id = p_action_id and user_id = (select auth.uid()) and status = 'approved';
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'get_recent_people(int)', 'create_circle(text)', 'delete_circle(uuid)', 'add_circle_member(uuid, uuid)',
    'remove_circle_member(uuid, uuid)', 'set_agent_grant(text, boolean)', 'mute_host(uuid)', 'unmute_host(uuid)',
    'propose_action(text, uuid, jsonb, int)', 'approve_action(uuid)', 'cancel_action(uuid)', 'mark_action_executed(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
