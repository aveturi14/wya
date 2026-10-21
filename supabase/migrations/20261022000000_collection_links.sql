-- Stage 1.1b: collection links (docs/split-app/STAGE_1_1_LINKS.md).
--
-- Every collection gets a link for a group chat (/c/<code>). Opening it shows
-- the booking page (signed out too: never a PayID, names or the event's
-- details). "I'm in" from the link is a REQUEST: nothing is owed and no PayID is
-- shown until the organiser approves; approving creates the collect debt.
-- The link opens the collection only, never the event. People already on the
-- event still join straight away (1.1). Collections can also stand alone,
-- backed by a hidden event (events.kind = 'collection') that never shows up as
-- an event. Per-person amounts are capped at $200. Safe to re-run.

------------------------------------------------------------------------------
-- Tables and columns
------------------------------------------------------------------------------
create or replace function private.make_link_code()
returns text language sql volatile set search_path = '' as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;
revoke execute on function private.make_link_code() from public, anon, authenticated;

alter table public.collections add column if not exists link_code text default private.make_link_code();
update public.collections set link_code = private.make_link_code() where link_code is null;
alter table public.collections alter column link_code set not null;
create unique index if not exists collections_link_code_key on public.collections (link_code);
alter table public.collections add column if not exists link_enabled boolean not null default true;
-- Backed by a hidden event: no event of its own as far as anyone can see
alter table public.collections add column if not exists standalone boolean not null default false;

-- $200 a person, every collection (L-4)
alter table public.collections drop constraint if exists collections_per_person_cents_check;
alter table public.collections add constraint collections_per_person_cents_check check (per_person_cents between 100 and 20000);

-- Hidden events behind standalone collections
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('fixed', 'open', 'collection'));

-- "I'm in" from the link, waiting on the organiser
create table if not exists public.collection_requests (
  collection_id uuid not null references public.collections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (collection_id, user_id)
);
alter table public.collection_requests enable row level security;
revoke insert, update, delete on public.collection_requests from anon, authenticated;

-- The two policies below look at each other's tables, so they go through these
-- (security definer skips RLS inside, which avoids a policy loop)
create or replace function private.is_collection_organiser(p_collection_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collections where id = p_collection_id and organiser_id = (select auth.uid()));
$$;
create or replace function private.has_collection_request(p_collection_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collection_requests where collection_id = p_collection_id and user_id = (select auth.uid()));
$$;
revoke execute on function private.is_collection_organiser(uuid) from public, anon;
revoke execute on function private.has_collection_request(uuid) from public, anon;
grant execute on function private.is_collection_organiser(uuid) to authenticated;
grant execute on function private.has_collection_request(uuid) to authenticated;

drop policy if exists "Requesters and organisers see requests" on public.collection_requests;
create policy "Requesters and organisers see requests" on public.collection_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_collection_organiser(collection_id));
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'collection_requests') then
    alter publication supabase_realtime add table public.collection_requests;
  end if;
end $$;

-- People who asked through the link can see the collection row too (reads still go through get_collection)
drop policy if exists "Organisers and guests see collections" on public.collections;
create policy "Organisers and guests see collections" on public.collections for select to authenticated
  using (organiser_id = (select auth.uid())
         or (not standalone and private.is_event_guest(event_id))
         or private.has_collection_request(id));

-- Link opens and reports: private, for the stats and for us to review
create table if not exists private.collection_link_views (
  id bigint generated always as identity primary key,
  collection_id uuid not null references public.collections on delete cascade,
  user_id uuid references auth.users on delete set null,
  viewed_at timestamptz not null default now()
);
create index if not exists collection_link_views_idx on private.collection_link_views (collection_id);
alter table private.collection_link_views enable row level security;
revoke all on private.collection_link_views from public, anon, authenticated;

create table if not exists private.collection_reports (
  collection_id uuid not null references public.collections on delete cascade,
  reporter_id uuid not null references auth.users on delete cascade,
  reason text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (collection_id, reporter_id)
);
alter table private.collection_reports enable row level security;
revoke all on private.collection_reports from public, anon, authenticated;

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
  'direct_invite',
  'receipt_to_claim', 'receipt_ready', 'receipt_reopened',
  'wallet_paid',
  'collect_started', 'collect_paid', 'collect_confirmed', 'collect_funded', 'collect_unfunded', 'collect_booked',
  'collect_expired', 'collect_cancelled', 'collect_refund_requested', 'collect_refunded', 'collect_reminder',
  'collect_requested', 'collect_approved', 'collect_declined'
));

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
-- Who may see a collection: the organiser, a guest of its (real) event, someone in it, or someone who asked
create or replace function private.can_see_collection(p public.collections)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    p.organiser_id = (select auth.uid())
    or (not p.standalone and private.is_event_guest(p.event_id))
    or exists (select 1 from public.obligations o where o.collection_id = p.id and o.guest_id = (select auth.uid()))
    or exists (select 1 from public.collection_requests r where r.collection_id = p.id and r.user_id = (select auth.uid()))
  );
$$;
revoke execute on function private.can_see_collection(public.collections) from public, anon, authenticated;

-- The collect debt for one person (shared by join_collection and approve_request). Caller holds the collection lock.
create or replace function private.add_collect_share(p public.collections, p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ob uuid;
begin
  select id into v_ob from public.obligations where collection_id = p.id and guest_id = p_user;
  if v_ob is not null then return v_ob; end if;
  if p.status <> 'open' or p.deadline <= now() then
    raise exception 'This collection isn''t taking people any more' using errcode = 'P0001', hint = 'not_open';
  end if;
  if p.max_people is not null and cardinality(private.collection_members(p.id)) >= p.max_people then
    raise exception 'It''s full' using errcode = 'P0001', hint = 'full';
  end if;
  insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason, kind, collection_id)
  values (p.event_id, p_user, p.organiser_id, p.per_person_cents, 'collection', 'collect', p.id)
  returning id into v_ob;
  perform private.check_collection_funding(p.id);
  return v_ob;
end;
$$;
revoke execute on function private.add_collect_share(public.collections, uuid) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Creating: the $200 cap in the message, and standalone collections
------------------------------------------------------------------------------
-- Same as 1.1, with the $200 limit
create or replace function public.create_collection(
  p_event_id uuid, p_title text, p_per_person_cents int, p_min_people int, p_deadline timestamptz,
  p_max_people int default null, p_target_cents int default null, p_merchant_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.events%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_note text := nullif(btrim(coalesce(p_merchant_note, '')), '');
  v_id uuid;
  v_message uuid;
  v_guests uuid[];
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or not (
    v_event.host_id = v_uid
    or exists (select 1 from public.rsvps r where r.event_id = p_event_id and r.user_id = v_uid
               and r.status = 'yes' and r.attended is not false)
  ) then
    raise exception 'Only the host or someone going can collect money for this event' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_methods m where m.user_id = v_uid and m.provider = 'payid') then
    raise exception 'Add your PayID first, so people can pay you.' using errcode = 'P0001', hint = 'needs_payid';
  end if;
  if length(v_title) not between 1 and 80 then
    raise exception 'Say what it''s for (up to 80 characters)' using errcode = '22023', hint = 'title';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'Keep the note under 200 characters' using errcode = '22023', hint = 'note';
  end if;
  if p_per_person_cents is null or p_per_person_cents not between 100 and 20000 then
    raise exception 'Each person''s amount must be between $1 and $200' using errcode = '22023', hint = 'amount';
  end if;
  if p_min_people is null or p_min_people not between 1 and 200 then
    raise exception 'The minimum must be between 1 and 200 people' using errcode = '22023', hint = 'min_people';
  end if;
  if p_max_people is not null and p_max_people not between p_min_people and 200 then
    raise exception 'The most people can''t be less than the minimum' using errcode = '22023', hint = 'max_people';
  end if;
  if p_target_cents is not null and (p_target_cents < 100
     or p_target_cents > p_per_person_cents::bigint * coalesce(p_max_people, 200)) then
    raise exception 'That target can''t be reached at % each', to_char(p_per_person_cents / 100.0, 'FM$999990.00')
      using errcode = '22023', hint = 'target';
  end if;
  if p_deadline is null or p_deadline <= now() or p_deadline > now() + interval '60 days' then
    raise exception 'Pick a deadline in the next 60 days' using errcode = '22023', hint = 'deadline';
  end if;
  if exists (select 1 from public.collections where event_id = p_event_id and status in ('open', 'funded')) then
    raise exception 'There''s already a collection going on this event' using errcode = 'P0001', hint = 'already_collecting';
  end if;
  perform private.hit_rate_limit('collect:' || p_event_id, 10, interval '1 hour');

  begin
    insert into public.collections (event_id, organiser_id, title, merchant_note, per_person_cents, min_people,
                                    target_cents, max_people, deadline, standalone)
    values (p_event_id, v_uid, v_title, v_note, p_per_person_cents, p_min_people, p_target_cents, p_max_people, p_deadline,
            v_event.kind = 'collection')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'There''s already a collection going on this event' using errcode = 'P0001', hint = 'already_collecting';
  end;

  -- A hidden event has no chat and no guests to tell
  if v_event.kind <> 'collection' then
    v_message := private.post_message(p_event_id, v_uid, 'collect', null, jsonb_build_object(
      'collection_id', v_id, 'title', v_title, 'per_person_cents', p_per_person_cents,
      'deadline', p_deadline, 'status', 'open'
    ));
    update public.collections set message_id = v_message where id = v_id;
    select array_agg(x) into v_guests from (
      select v_event.host_id as x
      union
      select r.user_id from public.rsvps r where r.event_id = p_event_id and r.status not in ('requested', 'no')
    ) people;
    perform private.notify_collection(v_id, v_guests, 'collect_started', v_uid);
  end if;
  return v_id;
end;
$$;

-- A collection on its own: a hidden event holds it (L-5). Returns the collection id.
create or replace function public.create_standalone_collection(
  p_title text, p_per_person_cents int, p_min_people int, p_deadline timestamptz,
  p_max_people int default null, p_target_cents int default null, p_merchant_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_event uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  perform private.hit_rate_limit('collect_standalone:' || v_uid, 10, interval '1 hour');
  insert into public.events (host_id, title, date, address, kind, allow_guest_invites)
  values (v_uid, left(btrim(coalesce(p_title, '')), 80), coalesce(p_deadline, now() + interval '1 day'), '', 'collection', false)
  returning id into v_event;
  -- Same checks as any collection; a failure rolls the hidden event back too
  return public.create_collection(v_event, p_title, p_per_person_cents, p_min_people, p_deadline,
                                  p_max_people, p_target_cents, p_merchant_note);
end;
$$;

------------------------------------------------------------------------------
-- The link
------------------------------------------------------------------------------
-- The booking page, signed out too. Never a PayID, names, or the event's details.
create or replace function public.get_collection_preview(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_req text;
  v_ob public.obligations%rowtype;
begin
  select * into v from public.collections where link_code = p_code;
  if v.id is null then return null; end if;
  if not v.link_enabled then
    return jsonb_build_object('link_status', 'off', 'title', v.title,
      'organiser_name', (select full_name from public.profiles where id = v.organiser_id));
  end if;
  insert into private.collection_link_views (collection_id, user_id) values (v.id, v_uid);
  if v_uid is not null then
    select status into v_req from public.collection_requests where collection_id = v.id and user_id = v_uid;
    select * into v_ob from public.obligations where collection_id = v.id and guest_id = v_uid;
  end if;
  return jsonb_build_object(
    'link_status', 'open',
    'id', v.id, 'title', v.title, 'merchant_note', v.merchant_note,
    'per_person_cents', v.per_person_cents, 'min_people', v.min_people, 'max_people', v.max_people,
    'target_cents', private.collection_target(v), 'deadline', v.deadline, 'status', v.status,
    'organiser_name', (select full_name from public.profiles where id = v.organiser_id),
    'organiser_avatar', (select avatar_url from public.profiles where id = v.organiser_id),
    'joined', cardinality(private.collection_members(v.id)),
    'confirmed', (select count(*) from public.obligations o where o.collection_id = v.id and o.status = 'paid'
                  and o.confirmed_at is not null and private.collect_share_active(o)),
    -- Signed in: where the caller stands
    'me', case when v_uid is null then null
               when v.organiser_id = v_uid then 'organiser'
               when v_ob.id is not null then 'member'
               when not v.standalone and private.is_event_guest(v.event_id) then 'guest'
               else coalesce(v_req, 'none') end
  );
end;
$$;

-- "I'm in" from the link: a request (people on the event join straight away, L-3).
-- Returns { collection_id, state } with state 'requested' | 'member' | 'organiser'.
create or replace function public.request_to_join(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_req public.collection_requests%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v from public.collections where link_code = p_code for update;
  if v.id is null or not v.link_enabled then
    raise exception 'This link doesn''t work any more. Ask the organiser for a new one.' using errcode = 'P0001', hint = 'link_off';
  end if;
  if v.organiser_id = v_uid then
    return jsonb_build_object('collection_id', v.id, 'state', 'organiser');
  end if;
  if exists (select 1 from public.obligations where collection_id = v.id and guest_id = v_uid) then
    return jsonb_build_object('collection_id', v.id, 'state', 'member');
  end if;
  if not v.standalone and private.is_event_guest(v.event_id) then
    perform private.add_collect_share(v, v_uid);
    return jsonb_build_object('collection_id', v.id, 'state', 'member');
  end if;
  if v.status <> 'open' or v.deadline <= now() then
    raise exception 'This collection isn''t taking people any more' using errcode = 'P0001', hint = 'not_open';
  end if;

  select * into v_req from public.collection_requests where collection_id = v.id and user_id = v_uid;
  if v_req.status = 'declined' then
    raise exception 'The organiser said no to this one' using errcode = 'P0001', hint = 'declined';
  end if;
  if v_req.status = 'requested' then
    return jsonb_build_object('collection_id', v.id, 'state', 'requested');
  end if;
  perform private.hit_rate_limit('collect_request:' || v_uid, 30, interval '1 hour');
  -- New, withdrawn, or approved but left before paying: ask again
  insert into public.collection_requests (collection_id, user_id) values (v.id, v_uid)
  on conflict (collection_id, user_id) do update set status = 'requested', created_at = now(), decided_at = null;
  perform private.notify_collection(v.id, array[v.organiser_id], 'collect_requested', v_uid);
  return jsonb_build_object('collection_id', v.id, 'state', 'requested');
end;
$$;

create or replace function public.withdraw_request(p_collection_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.collection_requests set status = 'withdrawn', decided_at = now()
  where collection_id = p_collection_id and user_id = (select auth.uid()) and status = 'requested';
end;
$$;

create or replace function public.approve_request(p_collection_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v public.collections%rowtype := private.collection_for_organiser(p_collection_id);
  v_ob uuid;
begin
  if not exists (select 1 from public.collection_requests where collection_id = v.id and user_id = p_user_id and status = 'requested') then
    raise exception 'That person isn''t asking to join' using errcode = 'P0001', hint = 'no_request';
  end if;
  v_ob := private.add_collect_share(v, p_user_id);
  update public.collection_requests set status = 'approved', decided_at = now()
  where collection_id = v.id and user_id = p_user_id;
  perform private.notify_collection(v.id, array[p_user_id], 'collect_approved', v.organiser_id,
    jsonb_build_object('obligation_id', v_ob));
  return v_ob;
end;
$$;

create or replace function public.decline_request(p_collection_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype := private.collection_for_organiser(p_collection_id);
begin
  update public.collection_requests set status = 'declined', decided_at = now()
  where collection_id = v.id and user_id = p_user_id and status = 'requested';
  if not found then
    raise exception 'That person isn''t asking to join' using errcode = 'P0001', hint = 'no_request';
  end if;
  perform private.notify_collection(v.id, array[p_user_id], 'collect_declined', v.organiser_id);
end;
$$;

-- Turn the link off or on, or replace it (the old one stops working). Returns the code.
create or replace function public.set_collection_link(p_collection_id uuid, p_enabled boolean default true, p_new_code boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.collections%rowtype := private.collection_for_organiser(p_collection_id);
  v_code text;
begin
  update public.collections
  set link_enabled = coalesce(p_enabled, link_enabled),
      link_code = case when p_new_code then private.make_link_code() else link_code end
  where id = v.id
  returning link_code into v_code;
  return v_code;
end;
$$;

-- Report a collection from its link (L-6: stored for review, once per person)
create or replace function public.report_collection(p_code text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select id into v_id from public.collections where link_code = p_code;
  if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  insert into private.collection_reports (collection_id, reporter_id, reason)
  values (v_id, v_uid, nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
  on conflict (collection_id, reporter_id) do nothing;
end;
$$;

------------------------------------------------------------------------------
-- Reads: requests, link and who sees what
------------------------------------------------------------------------------
create or replace function public.get_collection(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_org boolean;
  v_mine public.obligations%rowtype;
  v_req text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v from public.collections where id = p_id;
  if v.id is null or not private.can_see_collection(v) then
    raise exception 'Ask the organiser for the link' using errcode = '42501', hint = 'not_a_guest';
  end if;
  v_org := v.organiser_id = v_uid;
  select * into v_mine from public.obligations where collection_id = v.id and guest_id = v_uid;
  select status into v_req from public.collection_requests where collection_id = v.id and user_id = v_uid;

  return jsonb_build_object(
    'id', v.id, 'event_id', v.event_id,
    'event_title', (select e.title from public.events e where e.id = v.event_id),
    'event_date', (select e.date from public.events e where e.id = v.event_id),
    'event_theme', (select e.theme from public.events e where e.id = v.event_id),
    -- Only for people who can open the event (never the hidden one)
    'can_open_event', not v.standalone and (v_org or private.is_event_host(v.event_id) or private.is_event_guest(v.event_id)),
    'standalone', v.standalone,
    'link_code', case when v_org then v.link_code end,
    'link_enabled', v.link_enabled,
    'organiser_id', v.organiser_id,
    'organiser_name', (select p.full_name from public.profiles p where p.id = v.organiser_id),
    'organiser_avatar', (select p.avatar_url from public.profiles p where p.id = v.organiser_id),
    'title', v.title, 'merchant_note', v.merchant_note,
    'per_person_cents', v.per_person_cents, 'min_people', v.min_people, 'max_people', v.max_people,
    'target_cents', private.collection_target(v), 'deadline', v.deadline, 'status', v.status,
    'funded_at', v.funded_at, 'booked_at', v.booked_at, 'closed_at', v.closed_at,
    'go_ahead_short', v.go_ahead_short, 'created_at', v.created_at,
    'is_organiser', v_org,
    'can_join', not v_org and not v.standalone and v.status = 'open' and v.deadline > now() and private.is_event_guest(v.event_id)
                and v_mine.id is null
                and (v.max_people is null or cardinality(private.collection_members(v.id)) < v.max_people),
    'counts', (
      select jsonb_build_object(
        'joined', count(*) filter (where private.collect_share_active(o)),
        'claimed', count(*) filter (where private.collect_share_active(o) and o.status = 'paid'),
        'confirmed', count(*) filter (where private.collect_share_active(o) and o.status = 'paid' and o.confirmed_at is not null),
        'claimed_cents', coalesce(sum(o.amount_cents) filter (where private.collect_share_active(o) and o.status = 'paid'), 0),
        'confirmed_cents', coalesce(sum(o.amount_cents) filter (where private.collect_share_active(o) and o.status = 'paid' and o.confirmed_at is not null), 0),
        'to_confirm', count(*) filter (where o.status = 'paid' and o.confirmed_at is null and o.refunded_at is null),
        'refunds_due', count(*) filter (where o.status = 'paid' and o.refund_requested_at is not null and o.refunded_at is null),
        'requests', (select count(*) from public.collection_requests r where r.collection_id = v.id and r.status = 'requested')
      ) from public.obligations o where o.collection_id = v.id
    ),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', o.guest_id, 'name', p.full_name, 'avatar_url', p.avatar_url,
        'state', case when o.refunded_at is not null then 'refunded'
                      when o.refund_requested_at is not null then 'refund_requested'
                      when o.status = 'disputed' then 'disputed'
                      when o.status = 'paid' and o.confirmed_at is not null then 'confirmed'
                      when o.status = 'paid' then 'says_paid'
                      else 'in' end,
        'amount_cents', o.amount_cents,
        'obligation_id', case when v_org or o.guest_id = v_uid then o.id end,
        'joined_at', o.created_at, 'paid_at', o.paid_at, 'confirmed_at', o.confirmed_at
      ) order by o.created_at)
      from public.obligations o left join public.profiles p on p.id = o.guest_id
      where o.collection_id = v.id
    ), '[]'::jsonb),
    -- The organiser decides on these
    'requests', case when v_org then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', p.full_name, 'avatar_url', p.avatar_url,
                                          'requested_at', r.created_at) order by r.created_at)
      from public.collection_requests r left join public.profiles p on p.id = r.user_id
      where r.collection_id = v.id and r.status = 'requested'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'my_request', v_req,
    'my_obligation_id', v_mine.id,
    'my_state', case when v_mine.id is null then null
                     when v_mine.refunded_at is not null then 'refunded'
                     when v_mine.refund_requested_at is not null then 'refund_requested'
                     when v_mine.status = 'disputed' then 'disputed'
                     when v_mine.status = 'paid' and v_mine.confirmed_at is not null then 'confirmed'
                     when v_mine.status = 'paid' then 'says_paid'
                     else 'in' end,
    'my_reference', v_mine.reference
  );
end;
$$;

-- Event guests join straight away (1.1); shares the share-creating rules with approvals
create or replace function public.join_collection(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_existing public.obligations%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v from public.collections where id = p_id for update;
  if v.id is null or v.standalone or not private.is_event_guest(v.event_id) then
    raise exception 'Ask the organiser for the link' using errcode = '42501', hint = 'not_a_guest';
  end if;
  if v.organiser_id = v_uid then
    raise exception 'You''re collecting this one' using errcode = 'P0001', hint = 'is_organiser';
  end if;
  select * into v_existing from public.obligations where collection_id = v.id and guest_id = v_uid;
  if v_existing.id is not null then
    if v_existing.refund_requested_at is not null or v_existing.refunded_at is not null then
      raise exception 'You''ve asked for your money back on this one' using errcode = 'P0001', hint = 'left';
    end if;
    return v_existing.id;
  end if;
  return private.add_collect_share(v, v_uid);
end;
$$;

create or replace function public.get_my_collections()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row order by (row->>'deadline')), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.id, 'event_id', c.event_id, 'event_title', e.title, 'title', c.title, 'status', c.status,
      'standalone', c.standalone,
      'deadline', c.deadline, 'per_person_cents', c.per_person_cents, 'min_people', c.min_people,
      'target_cents', private.collection_target(c),
      'organiser_id', c.organiser_id, 'organiser_name', op.full_name,
      'role', case when c.organiser_id = (select auth.uid()) then 'organiser'
                   when o.id is not null then 'member'
                   when r.status = 'requested' then 'requested'
                   else 'can_join' end,
      'my_obligation_id', o.id,
      'my_state', case when o.id is null then null
                       when o.refunded_at is not null then 'refunded'
                       when o.refund_requested_at is not null then 'refund_requested'
                       when o.status = 'disputed' then 'disputed'
                       when o.status = 'paid' and o.confirmed_at is not null then 'confirmed'
                       when o.status = 'paid' then 'says_paid'
                       else 'in' end,
      'joined', (select count(*) from public.obligations x where x.collection_id = c.id and private.collect_share_active(x)),
      'confirmed', (select count(*) from public.obligations x where x.collection_id = c.id and x.status = 'paid'
                    and x.confirmed_at is not null and private.collect_share_active(x)),
      'confirmed_cents', (select coalesce(sum(x.amount_cents), 0) from public.obligations x where x.collection_id = c.id
                          and x.status = 'paid' and x.confirmed_at is not null and private.collect_share_active(x)),
      'to_confirm', (select count(*) from public.obligations x where x.collection_id = c.id and x.status = 'paid'
                     and x.confirmed_at is null and x.refunded_at is null),
      'refunds_due', (select count(*) from public.obligations x where x.collection_id = c.id and x.status = 'paid'
                      and x.refund_requested_at is not null and x.refunded_at is null),
      'requests', case when c.organiser_id = (select auth.uid())
                       then (select count(*) from public.collection_requests q where q.collection_id = c.id and q.status = 'requested')
                       else 0 end
    ) as row
    from public.collections c
    join public.events e on e.id = c.event_id
    left join public.profiles op on op.id = c.organiser_id
    left join public.obligations o on o.collection_id = c.id and o.guest_id = (select auth.uid())
    left join public.collection_requests r on r.collection_id = c.id and r.user_id = (select auth.uid())
    where c.organiser_id = (select auth.uid())
       or o.id is not null
       or r.status = 'requested'
       or (c.status = 'open' and c.deadline > now() and not c.standalone and private.is_event_guest(c.event_id))
  ) x;
$$;

------------------------------------------------------------------------------
-- Hidden events stay hidden (§4): Chats, Photos and the host's track record
------------------------------------------------------------------------------
create or replace function public.get_my_chats()
returns table (
  event_id uuid, title text, theme text, cover_image text, date timestamptz,
  last_message text, last_sender_id uuid, last_sender_name text, last_message_at timestamptz, unread int
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select e.id, e.title, e.theme, e.cover_image, e.date
    from public.events e
    where e.kind <> 'collection'
      and (e.host_id = (select auth.uid())
           or exists (
             select 1 from public.rsvps r
             where r.event_id = e.id and r.user_id = (select auth.uid()) and r.status in ('yes', 'maybe')
           ))
  )
  select m.id, m.title, m.theme, m.cover_image, m.date,
         case lm.kind
           when 'image' then '📷 Photo'
           when 'poll' then '📊 Poll' || coalesce(': ' || (lm.data->>'question'), '')
           when 'split' then '💸 Split' || coalesce(': ' || (lm.data->>'description'), '')
           when 'receipt' then '🧾 Bill' || coalesce(': ' || (lm.data->>'description'), '')
           when 'collect' then '💰 Collecting' || coalesce(': ' || (lm.data->>'title'), '')
           when 'plan' then '🗓 Plan'
           when 'bot' then 'wya: ' || lm.content
           else coalesce(lm.content, case when lm.image_path is not null then '📷 Photo' end)
         end,
         lm.user_id, lp.full_name, lm.created_at,
         (
           select count(*)::int from public.chat_messages c
           where c.event_id = m.id
             -- `is distinct from`, so messages with no sender (wya's replies) count too
             and c.user_id is distinct from (select auth.uid())
             and c.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)
         )
  from mine m
  left join lateral (
    select c.content, c.image_path, c.user_id, c.created_at, c.kind, c.data from public.chat_messages c
    where c.event_id = m.id order by c.created_at desc limit 1
  ) lm on true
  left join public.profiles lp on lp.id = lm.user_id
  left join public.chat_reads cr on cr.event_id = m.id and cr.user_id = (select auth.uid())
  -- Most recent conversations first; chats nobody has written in yet go last
  order by lm.created_at desc nulls last, m.date;
$$;

create or replace function public.get_my_albums()
returns table (event_id uuid, title text, theme text, cover_image text, starts_at timestamptz, photo_count int, thumb_paths text[], is_open boolean)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    -- Narrow to the caller's own events first, then apply the album rule itself
    select e.id from public.events e where e.host_id = (select auth.uid()) and e.kind <> 'collection'
    union
    select r.event_id from public.rsvps r where r.user_id = (select auth.uid())
  )
  select e.id, e.title, e.theme, e.cover_image, e.date,
         coalesce(c.n, 0)::int,
         coalesce(t.paths, '{}'::text[]),
         now() < e.date + interval '30 days'  -- open from when the event is made
  from candidates k
  join public.events e on e.id = k.id
  left join lateral (select count(*) as n from public.photos p where p.event_id = e.id) c on true
  left join lateral (
    select array_agg(x.thumb_path order by x.created_at desc) as paths
    from (select p.thumb_path, p.created_at from public.photos p
          where p.event_id = e.id order by p.created_at desc limit 6) x
  ) t on true
  where private.can_view_photos(e.id)
    and (coalesce(c.n, 0) > 0 or (now() >= e.date and now() < e.date + interval '30 days'))
  order by e.date desc;
$$;

create or replace function public.get_host_record(p_host_id uuid)
returns table (hosted int, happened int, cancelled_late int)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_host_id <> v_uid and not private.shares_event_with(p_host_id) then
    return;
  end if;
  return query
    select
      (select count(*)::int from public.events e where e.host_id = p_host_id and e.date < now() and e.kind <> 'collection'),
      -- Happened: past events with someone Going, or with Who came? filled in
      (select count(*)::int from public.events e
       where e.host_id = p_host_id and e.date < now() and e.kind <> 'collection'
         and exists (select 1 from public.rsvps r where r.event_id = e.id
                     and (r.status = 'yes' or r.attendance_marked_at is not null))),
      (select count(*)::int from private.host_cancellations c where c.host_id = p_host_id);
end;
$$;

------------------------------------------------------------------------------
-- Stats: standalone vs event, the link funnel, reports
------------------------------------------------------------------------------
create or replace function public.get_collect_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with c as (
    select c.* from public.collections c
    join auth.users u on u.id = c.organiser_id
    where u.email not like '%@wya.test'
  ),
  s as (
    select o.* from public.obligations o join c on c.id = o.collection_id
  ),
  per as (
    select c.id, c.min_people, c.organiser_id,
           (select count(*) from s where s.collection_id = c.id) as joined,
           (select count(*) from s where s.collection_id = c.id and (s.status = 'paid' or s.refunded_at is not null)) as paid
    from c
  ),
  closed as (select * from c where c.status <> 'open' or c.deadline <= now()),
  views as (select v.* from private.collection_link_views v join c on c.id = v.collection_id),
  reqs as (select r.* from public.collection_requests r join c on c.id = r.collection_id),
  via_link as (select s.* from s join reqs r on r.collection_id = s.collection_id and r.user_id = s.guest_id)
  select jsonb_build_object(
    'collections', (select count(*) from c),
    'funded_by_deadline_pct', round(100.0 * (select count(*) from closed where funded_at is not null and funded_at <= deadline)
                                     / nullif((select count(*) from closed), 0), 1),
    'booked_pct', round(100.0 * (select count(*) from c where c.status = 'booked') / nullif((select count(*) from c), 0), 1),
    'median_hours_to_funded', (select round((percentile_cont(0.5) within group (order by extract(epoch from c.funded_at - c.created_at) / 3600))::numeric, 1)
                               from c where c.funded_at is not null),
    'funded_within_48h_pct', round(100.0 * (select count(*) from c where c.funded_at is not null and c.funded_at - c.created_at <= interval '48 hours')
                                    / nullif((select count(*) from c where c.funded_at is not null), 0), 1),
    'go_ahead_short', (select count(*) from c where c.go_ahead_short),
    'avg_joined', (select round(avg(joined), 2) from per),
    'avg_min_people', (select round(avg(min_people), 2) from per),
    'joined_who_paid_pct', round(100.0 * (select sum(paid) from per) / nullif((select sum(joined) from per), 0), 1),
    'claims_confirmed_pct', round(100.0 * (select count(*) from s where s.confirmed_at is not null)
                                   / nullif((select count(*) from s where s.paid_at is not null or s.confirmed_at is not null), 0), 1),
    'organisers', (select count(distinct organiser_id) from c),
    'repeat_organisers', (select count(*) from (select organiser_id from c group by organiser_id having count(*) >= 2) x),
    'expired', (select count(*) from c where c.status = 'expired'),
    'cancelled', (select count(*) from c where c.status = 'cancelled'),
    'refunds_owed', (select count(*) from s where s.refund_requested_at is not null and s.status = 'paid'),
    'refunds_done', (select count(*) from s where s.refunded_at is not null),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from c group by status) x),
    -- Standalone vs with an event
    'by_kind', jsonb_build_object(
      'standalone', jsonb_build_object('collections', (select count(*) from c where standalone),
        'funded_by_deadline_pct', round(100.0 * (select count(*) from closed where standalone and funded_at is not null and funded_at <= deadline)
                                        / nullif((select count(*) from closed where standalone), 0), 1)),
      'with_event', jsonb_build_object('collections', (select count(*) from c where not standalone),
        'funded_by_deadline_pct', round(100.0 * (select count(*) from closed where not standalone and funded_at is not null and funded_at <= deadline)
                                        / nullif((select count(*) from closed where not standalone), 0), 1))
    ),
    -- The link funnel: opened → asked → approved → said paid → confirmed
    'link_funnel', jsonb_build_object(
      'opens', (select count(*) from views),
      'opens_signed_in', (select count(distinct (collection_id, user_id)) from views where user_id is not null),
      'requests', (select count(*) from reqs),
      'approved', (select count(*) from reqs where status = 'approved'),
      'declined', (select count(*) from reqs where status = 'declined'),
      'withdrawn', (select count(*) from reqs where status = 'withdrawn'),
      'waiting', (select count(*) from reqs where status = 'requested'),
      'paid', (select count(*) from via_link where status = 'paid' or refunded_at is not null),
      'confirmed', (select count(*) from via_link where confirmed_at is not null)
    ),
    'reports', (select count(*) from private.collection_reports r join c on c.id = r.collection_id),
    'collections_reported', (select count(distinct r.collection_id) from private.collection_reports r join c on c.id = r.collection_id)
  );
$$;
revoke execute on function public.get_collect_stats() from public, anon, authenticated;
grant execute on function public.get_collect_stats() to service_role;

------------------------------------------------------------------------------
-- Who may call what
------------------------------------------------------------------------------
revoke execute on function public.get_collection_preview(text) from public;
grant execute on function public.get_collection_preview(text) to anon, authenticated;

do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.create_collection(uuid, text, int, int, timestamptz, int, int, text)',
    'public.create_standalone_collection(text, int, int, timestamptz, int, int, text)',
    'public.request_to_join(text)',
    'public.withdraw_request(uuid)',
    'public.approve_request(uuid, uuid)',
    'public.decline_request(uuid, uuid)',
    'public.set_collection_link(uuid, boolean, boolean)',
    'public.report_collection(text, text)',
    'public.get_collection(uuid)',
    'public.join_collection(uuid)',
    'public.get_my_collections()',
    'public.get_my_chats()',
    'public.get_my_albums()',
    'public.get_host_record(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
