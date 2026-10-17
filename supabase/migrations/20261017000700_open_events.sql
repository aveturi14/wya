-- Phase 8.7: open events (docs/PHASE8.md §4, 8.7).
--
-- "Dinner sometime next week — when works?" The plan is the anchor; the time is
-- picked by the group. The host offers candidate times, everyone marks
-- yes / maybe / no, the best time rises to the top, and the host locks it in.
--   * An open event can't carry a pledge (OPEN-3): nobody pledges to a time
--     that doesn't exist yet. Pledges can be turned on after locking.
--   * `date` stays required and holds the earliest candidate, so sorting,
--     cutoffs and the album window keep working; the app shows "Time TBD".
--   * Locking doesn't change anyone's RSVP (OPEN-2): saying yes to a time isn't
--     saying "I'm in". Everyone gets one "It's on" in Activity.
-- Safe to re-run.

alter table public.events add column if not exists kind text not null default 'fixed';
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('fixed', 'open'));
alter table public.events drop constraint if exists events_open_no_pledge;
alter table public.events add constraint events_open_no_pledge check (kind = 'fixed' or deposit_mode = 'none');
-- events.address isn't selectable, so readable columns are granted one by one (see address_gating)
grant select (kind) on public.events to authenticated;

create table if not exists public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  label text check (label is null or length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists event_slots_event_idx on public.event_slots (event_id, starts_at);
alter table public.event_slots enable row level security;
revoke insert, update, delete on public.event_slots from anon, authenticated;
drop policy if exists "Event people see candidate times" on public.event_slots;
create policy "Event people see candidate times" on public.event_slots for select to authenticated
  using (private.is_event_host(event_id) or private.is_event_guest(event_id));

create table if not exists public.slot_votes (
  slot_id uuid not null references public.event_slots on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (slot_id, user_id)
);
create index if not exists slot_votes_event_idx on public.slot_votes (event_id);
alter table public.slot_votes enable row level security;
revoke insert, update, delete on public.slot_votes from anon, authenticated;
-- Who answered what is visible to everyone on the event, like a Doodle poll
drop policy if exists "Event people see answers" on public.slot_votes;
create policy "Event people see answers" on public.slot_votes for select to authenticated
  using (private.is_event_host(event_id) or private.is_event_guest(event_id));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added',
  'join_requested', 'join_approved',
  'split_owed',
  'rsvp_reminder', 'excuse_prompt',
  'event_locked'
));

-- Locking sends "It's on", so the time change it causes shouldn't also send "changed the time"
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

  -- An open event's date is only its earliest candidate: moving it (adding times,
  -- or locking, which sends its own "It's on") isn't news
  if (new.date is distinct from old.date or new.end_date is distinct from old.end_date) and old.kind = 'fixed' and new.kind = 'fixed' then
    v_changes := array_append(v_changes, 'time');
  end if;
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

-- Host only, on an open event; 2–12 candidate times in total, all in the future (OPEN-1)
create or replace function public.add_slots(p_event_id uuid, p_slots jsonb)
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_slot jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  select * into v_event from public.events where id = p_event_id;
  if (select auth.uid()) is null or v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can add times' using errcode = '42501';
  end if;
  if v_event.kind <> 'open' then
    raise exception 'This plan already has its time' using errcode = 'P0001', hint = 'not_open';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Add at least one time' using errcode = '22023';
  end if;
  if (select count(*) from public.event_slots where event_id = p_event_id) + jsonb_array_length(p_slots) > 12 then
    raise exception 'Up to 12 times per plan' using errcode = '22023';
  end if;
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_start := (v_slot->>'starts_at')::timestamptz;
    v_end := nullif(v_slot->>'ends_at', '')::timestamptz;
    if v_start is null or v_start <= now() then
      raise exception 'Times have to be in the future' using errcode = '22023';
    end if;
    insert into public.event_slots (event_id, starts_at, ends_at, label)
    values (p_event_id, v_start, v_end, nullif(btrim(coalesce(v_slot->>'label', '')), ''))
    returning id into v_id;
    v_ids := array_append(v_ids, v_id);
  end loop;
  -- Keep the event's tentative date on the earliest candidate
  update public.events set date = (select min(starts_at) from public.event_slots where event_id = p_event_id)
  where id = p_event_id;
  return v_ids;
end;
$$;

-- {slot_id: 'yes' | 'maybe' | 'no'}; replaces your earlier answers for those times
create or replace function public.set_availability(p_event_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
begin
  if v_uid is null or not (private.is_event_host(p_event_id) or private.is_event_guest(p_event_id)) then
    raise exception 'Only people on this plan can answer' using errcode = '42501';
  end if;
  select kind into v_kind from public.events where id = p_event_id;
  if v_kind <> 'open' then
    raise exception 'The time is already locked in' using errcode = 'P0001', hint = 'not_open';
  end if;
  if exists (
    select 1 from jsonb_each_text(p_answers) a
    where a.value not in ('yes', 'maybe', 'no')
       or not exists (select 1 from public.event_slots s where s.id = a.key::uuid and s.event_id = p_event_id)
  ) then
    raise exception 'Those times aren''t on this plan' using errcode = '22023';
  end if;
  insert into public.slot_votes (slot_id, event_id, user_id, answer)
  select a.key::uuid, p_event_id, v_uid, a.value from jsonb_each_text(p_answers) a
  on conflict (slot_id, user_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

-- Each time with its counts and rank: most yes, then most maybe, then earliest.
-- `answers` lists who said what (the host counts like anyone).
create or replace function public.get_slot_summary(p_event_id uuid)
returns table (slot_id uuid, starts_at timestamptz, ends_at timestamptz, label text,
               yes int, maybe int, no int, rank int, answers jsonb)
language sql stable security definer set search_path = '' as $$
  with counted as (
    select s.id, s.starts_at, s.ends_at, s.label,
           count(*) filter (where v.answer = 'yes')::int as yes,
           count(*) filter (where v.answer = 'maybe')::int as maybe,
           count(*) filter (where v.answer = 'no')::int as no,
           coalesce(jsonb_agg(jsonb_build_object('user_id', v.user_id, 'answer', v.answer)) filter (where v.user_id is not null), '[]'::jsonb) as answers
    from public.event_slots s
    left join public.slot_votes v on v.slot_id = s.id
    where s.event_id = p_event_id
      and (private.is_event_host(p_event_id) or private.is_event_guest(p_event_id))
    group by s.id
  )
  select c.id, c.starts_at, c.ends_at, c.label, c.yes, c.maybe, c.no,
         (row_number() over (order by c.yes desc, c.maybe desc, c.starts_at))::int,
         c.answers
  from counted c
  order by c.starts_at;
$$;

-- The host picks the time: the event gets it, becomes fixed, and everyone hears "It's on"
create or replace function public.lock_event(p_event_id uuid, p_slot_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_slot public.event_slots%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if (select auth.uid()) is null or v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can lock in the time' using errcode = '42501';
  end if;
  if v_event.kind <> 'open' then
    raise exception 'The time is already locked in' using errcode = 'P0001', hint = 'not_open';
  end if;
  select * into v_slot from public.event_slots where id = p_slot_id and event_id = p_event_id;
  if v_slot.id is null then
    raise exception 'That time isn''t on this plan' using errcode = '22023';
  end if;
  update public.events set date = v_slot.starts_at, end_date = v_slot.ends_at, kind = 'fixed' where id = p_event_id;
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select r.user_id, 'event_locked', p_event_id, v_event.host_id, jsonb_build_object(
    'title', v_event.title, 'starts_at', v_slot.starts_at,
    'actor_name', (select full_name from public.profiles where id = v_event.host_id))
  from public.rsvps r where r.event_id = p_event_id and r.status not in ('no', 'requested');
end;
$$;

revoke execute on function public.add_slots(uuid, jsonb) from public, anon;
revoke execute on function public.set_availability(uuid, jsonb) from public, anon;
revoke execute on function public.get_slot_summary(uuid) from public, anon;
revoke execute on function public.lock_event(uuid, uuid) from public, anon;
grant execute on function public.add_slots(uuid, jsonb) to authenticated;
grant execute on function public.set_availability(uuid, jsonb) to authenticated;
grant execute on function public.get_slot_summary(uuid) to authenticated;
grant execute on function public.lock_event(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
