-- Phase 8.3: bill splitting (docs/PHASE8.md §4, 8.3).
--
-- "/split 120 dinner": whoever paid splits the bill with everyone going, and
-- each person pays them back directly by PayID, exactly like a pledge debt.
-- wya never touches the money. Splits reuse `obligations` (kind 'split') so
-- "I've paid", disputes, waiving, the PayID card and Activity all work as they
-- do for pledges. Two differences, on purpose:
--   * a split debt never blocks RSVPs (an unpaid pizza share isn't a flake);
--   * it doesn't count against anyone's reliability record.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.split_bills (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  -- Who paid the bill, and is owed the shares
  payer_id uuid not null references auth.users on delete cascade,
  description text not null check (length(description) between 1 and 80),
  total_cents int not null check (total_cents between 1 and 1000000),
  payer_share_cents int not null default 0 check (payer_share_cents >= 0),
  currency text not null default 'AUD',
  message_id uuid references public.chat_messages on delete set null,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists split_bills_event_idx on public.split_bills (event_id);
alter table public.split_bills enable row level security;
revoke insert, update, delete on public.split_bills from anon, authenticated;

alter table public.obligations add column if not exists kind text not null default 'pledge';
alter table public.obligations add column if not exists split_id uuid references public.split_bills on delete cascade;
alter table public.obligations drop constraint if exists obligations_kind_check;
alter table public.obligations add constraint obligations_kind_check check (kind in ('pledge', 'split'));
alter table public.obligations drop constraint if exists obligations_split_shape;
alter table public.obligations add constraint obligations_split_shape check ((kind = 'split') = (split_id is not null));
-- `host_id` keeps its name but means "who is owed": the host for a pledge, the payer for a split
alter table public.obligations drop constraint if exists obligations_reason_check;
alter table public.obligations add constraint obligations_reason_check check (reason in ('no_show', 'late_cancel', 'shared_cost'));

-- One pledge debt per guest per event still; any number of splits
alter table public.obligations drop constraint if exists obligations_event_id_guest_id_key;
create unique index if not exists obligations_pledge_unique on public.obligations (event_id, guest_id) where kind = 'pledge';
create unique index if not exists obligations_split_unique on public.obligations (split_id, guest_id) where split_id is not null;

-- After obligations.split_id exists (the policy refers to it)
-- Read through get_split (which also hides shares from non-participants)
drop policy if exists "Payers and participants see splits" on public.split_bills;
create policy "Payers and participants see splits" on public.split_bills for select to authenticated
  using (payer_id = (select auth.uid())
         -- Qualified: inside the subquery a bare `id` would mean obligations.id
         or exists (select 1 from public.obligations o where o.split_id = split_bills.id and o.guest_id = (select auth.uid())));

------------------------------------------------------------------------------
-- Pledge rules that must ignore splits
------------------------------------------------------------------------------
-- Only an unpaid PLEDGE blocks RSVPs to that host (SPLIT-1)
create or replace function private.has_open_debt(p_guest uuid, p_host uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.obligations
    where guest_id = p_guest and host_id = p_host and kind = 'pledge'
      and status in ('owed', 'excuse_pending', 'disputed')
  );
$$;

-- The unique index is now partial, so ON CONFLICT names its predicate
create or replace function private.rsvp_late_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  if old.status = 'yes' and new.status = 'no' and new.pledge_cents is not null then
    select * into v_event from public.events where id = new.event_id;
    if now() >= private.cutoff_at(v_event) then
      insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason)
      values (new.event_id, new.user_id, v_event.host_id, new.pledge_cents, 'late_cancel')
      on conflict (event_id, guest_id) where kind = 'pledge' do nothing;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_attendance(p_event_id uuid, p_absent uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can mark attendance' using errcode = '42501';
  end if;
  if now() < v_event.date then
    raise exception 'You can mark who came once the event has started.' using errcode = 'P0001';
  end if;
  if now() > v_event.date + interval '7 days' then
    raise exception 'Attendance can only be marked within 7 days of the event.' using errcode = 'P0001';
  end if;

  update public.rsvps
  set attended = not (user_id = any (coalesce(p_absent, '{}'))), attendance_marked_at = now()
  where event_id = p_event_id and status = 'yes';

  -- New no-shows with a pledge owe it
  insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason)
  select p_event_id, r.user_id, v_event.host_id, r.pledge_cents, 'no_show'
  from public.rsvps r
  where r.event_id = p_event_id and r.status = 'yes' and r.attended = false and r.pledge_cents is not null
  on conflict (event_id, guest_id) where kind = 'pledge' do nothing;

  -- Re-ticked guests: drop the no-show debt unless it's already been paid
  delete from public.obligations o
  using public.rsvps r
  where o.event_id = p_event_id and o.kind = 'pledge' and o.reason = 'no_show' and o.status <> 'paid'
    and r.event_id = o.event_id and r.user_id = o.guest_id and r.attended = true;
end;
$$;

-- "Let everyone off" is the host's call on pledges; splits are between guests
create or replace function public.waive_all(p_event_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not exists (select 1 from public.events where id = p_event_id and host_id = (select auth.uid())) then
    raise exception 'Only the host can waive debts' using errcode = '42501';
  end if;
  update public.obligations set status = 'waived', resolved_at = now()
  where event_id = p_event_id and kind = 'pledge' and status in ('owed', 'excuse_pending', 'disputed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Reliability is about showing up: split debts don't count as open debts
create or replace function public.get_reliability(p_user_id uuid)
returns table (attended int, counted int, open_debts int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id <> (select auth.uid()) and not exists (
    select 1 from public.rsvps r join public.events e on e.id = r.event_id
    where r.user_id = p_user_id and e.host_id = (select auth.uid())
  ) then
    return;
  end if;
  -- Table aliases avoid clashing with the output column names
  return query
    select
      (select count(*)::int from public.rsvps r where r.user_id = p_user_id and r.attended = true),
      (select count(*)::int from public.rsvps r where r.user_id = p_user_id and r.attended is not null)
        + (select count(*)::int from public.obligations o where o.guest_id = p_user_id and o.reason = 'late_cancel'),
      (select count(*)::int from public.obligations o
       where o.guest_id = p_user_id and o.kind = 'pledge' and o.status in ('owed', 'excuse_pending', 'disputed'));
end;
$$;

-- Every debt you're part of, now with its kind and (for splits) what it was for
drop function if exists public.get_my_obligations();
create function public.get_my_obligations()
returns table (
  id uuid, event_id uuid, event_title text, event_theme text, event_date timestamptz, role text,
  other_user_id uuid, other_name text, amount_cents int, currency text, reason text, status text,
  reference text, excuse text, excuse_declined boolean, created_at timestamptz, paid_at timestamptz,
  kind text, split_id uuid, description text
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.title, e.theme, e.date,
         case when o.guest_id = (select auth.uid()) then 'guest' else 'host' end,
         case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end,
         p.full_name, o.amount_cents, o.currency, o.reason, o.status,
         o.reference, o.excuse, o.excuse_declined, o.created_at, o.paid_at,
         o.kind, o.split_id, sb.description
  from public.obligations o
  join public.events e on e.id = o.event_id
  left join public.split_bills sb on sb.id = o.split_id
  left join public.profiles p on p.id = case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end
  where o.guest_id = (select auth.uid()) or o.host_id = (select auth.uid())
  order by o.created_at desc;
$$;
revoke execute on function public.get_my_obligations() from public, anon;
grant execute on function public.get_my_obligations() to authenticated;

------------------------------------------------------------------------------
-- Notifications: a new split debt is 'split_owed'; the rest reuse the pledge types
------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added',
  'join_requested', 'join_approved',
  'split_owed'
));

create or replace function private.notify_obligation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text := (select title from public.events where id = new.event_id);
  v_guest text := (select full_name from public.profiles where id = new.guest_id);
  v_host text := (select full_name from public.profiles where id = new.host_id);
  v_what text := (select description from public.split_bills where id = new.split_id);
  v_type text; v_to uuid; v_actor uuid; v_actor_name text;
begin
  if tg_op = 'INSERT' then
    v_type := case when new.kind = 'split' then 'split_owed' else 'pledge_owed' end;
    v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  elsif new.status = old.status then
    return new;
  elsif new.status = 'paid' then
    v_type := 'payment_claimed'; v_to := new.host_id; v_actor := new.guest_id; v_actor_name := v_guest;
  elsif new.status = 'disputed' then
    v_type := 'payment_disputed'; v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  elsif new.status = 'excuse_pending' then
    v_type := 'excuse_submitted'; v_to := new.host_id; v_actor := new.guest_id; v_actor_name := v_guest;
  elsif old.status = 'excuse_pending' then
    v_type := 'excuse_resolved'; v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  elsif new.status = 'waived' then
    v_type := 'debt_waived'; v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  else
    return new;
  end if;

  insert into public.notifications (user_id, type, event_id, actor_id, data)
  values (v_to, v_type, new.event_id, v_actor, jsonb_build_object(
    'title', v_title, 'actor_name', v_actor_name, 'amount_cents', new.amount_cents,
    'reason', new.reason, 'accepted', new.status = 'waived', 'obligation_id', new.id,
    'kind', new.kind, 'description', v_what
  ));
  return new;
end;
$$;

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
-- The caller paid the bill. Default: everyone going (the host and Going guests,
-- minus marked no-shows) shares it evenly, the payer absorbing the odd cents.
-- Or custom shares {user_id: cents} that add up to the total.
create or replace function public.create_split(
  p_event_id uuid, p_description text, p_total_cents int,
  p_participants uuid[] default null, p_shares jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.events%rowtype;
  v_desc text := btrim(coalesce(p_description, ''));
  v_eligible uuid[];
  v_people uuid[];
  v_shares jsonb := '{}'::jsonb;
  v_each int;
  v_n int;
  v_sum bigint;
  v_split uuid;
  v_message uuid;
  v_person uuid;
  v_cents int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_event from public.events where id = p_event_id;
  -- Who's "going": the host, and Going guests not marked as no-shows
  select array_agg(x) into v_eligible from (
    select v_event.host_id as x
    union
    select r.user_id from public.rsvps r
    where r.event_id = p_event_id and r.status = 'yes' and r.attended is not false
  ) going;
  if v_event.id is null or not (v_uid = any (coalesce(v_eligible, '{}'))) then
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_methods m where m.user_id = v_uid and m.provider = 'payid') then
    raise exception 'Add your PayID first (You → Get paid), so people can pay you back.' using errcode = 'P0001', hint = 'payid_required';
  end if;
  if length(v_desc) not between 1 and 80 then
    raise exception 'Say what it was for (up to 80 characters)' using errcode = '22023';
  end if;
  if p_total_cents is null or p_total_cents not between 1 and 1000000 then
    raise exception 'The total must be between $0.01 and $10,000' using errcode = '22023';
  end if;

  if p_shares is not null then
    -- Custom amounts: everyone named must be going, and the amounts must add up
    select array_agg(k::uuid), sum((v)::bigint) into v_people, v_sum from jsonb_each_text(p_shares) as s(k, v);
    if v_people is null or not (v_people <@ v_eligible) then
      raise exception 'Everyone in a split must be going' using errcode = '22023', hint = 'split_not_going';
    end if;
    if v_sum <> p_total_cents or exists (select 1 from jsonb_each_text(p_shares) s(k, v) where v::bigint < 0) then
      raise exception 'The shares have to add up to the total' using errcode = '22023', hint = 'shares_mismatch';
    end if;
    v_shares := p_shares;
  else
    v_people := coalesce(p_participants, v_eligible);
    if not (v_people <@ v_eligible) then
      raise exception 'Everyone in a split must be going' using errcode = '22023', hint = 'split_not_going';
    end if;
    -- The payer always shares the cost
    if not (v_uid = any (v_people)) then
      v_people := array_append(v_people, v_uid);
    end if;
    v_n := cardinality(v_people);
    v_each := floor(p_total_cents::numeric / v_n);
    foreach v_person in array v_people loop
      v_shares := v_shares || jsonb_build_object(
        v_person::text,
        case when v_person = v_uid then p_total_cents - v_each * (v_n - 1) else v_each end
      );
    end loop;
  end if;

  perform private.hit_rate_limit('split:' || p_event_id, 20, interval '1 hour');

  insert into public.split_bills (event_id, payer_id, description, total_cents, payer_share_cents)
  values (p_event_id, v_uid, v_desc, p_total_cents, coalesce((v_shares->>v_uid::text)::int, 0))
  returning id into v_split;

  for v_person, v_cents in select k::uuid, v::int from jsonb_each_text(v_shares) as s(k, v) loop
    if v_person <> v_uid and v_cents > 0 then
      insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason, kind, split_id)
      values (p_event_id, v_person, v_uid, v_cents, 'shared_cost', 'split', v_split);
    end if;
  end loop;

  v_message := private.post_message(p_event_id, v_uid, 'split', null, jsonb_build_object(
    'split_id', v_split, 'description', v_desc, 'total_cents', p_total_cents,
    'people', (select count(*) from jsonb_object_keys(v_shares))
  ));
  update public.split_bills set message_id = v_message where id = v_split;
  return v_split;
end;
$$;

-- Each person's share and status, for the payer and the people in it only.
-- PayIDs never appear here; your own debt's id comes back so the app can open the pay page.
create or replace function public.get_split(p_split_id uuid)
returns table (user_id uuid, name text, share_cents int, status text, is_payer boolean, obligation_id uuid,
               description text, total_cents int, split_status text)
language sql stable security definer set search_path = '' as $$
  with s as (
    select sb.* from public.split_bills sb
    where sb.id = p_split_id
      and (sb.payer_id = (select auth.uid())
           or exists (select 1 from public.obligations o where o.split_id = sb.id and o.guest_id = (select auth.uid())))
  )
  select s.payer_id, p.full_name, s.payer_share_cents, 'payer', true, null::uuid, s.description, s.total_cents, s.status
  from s left join public.profiles p on p.id = s.payer_id
  union all
  select o.guest_id, p.full_name, o.amount_cents, o.status, false,
         case when o.guest_id = (select auth.uid()) then o.id end,
         s.description, s.total_cents, s.status
  from s
  join public.obligations o on o.split_id = s.id
  left join public.profiles p on p.id = o.guest_id;
$$;

-- The payer cancels a split: anything still owed is waived
create or replace function public.cancel_split(p_split_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.split_bills where id = p_split_id and payer_id = (select auth.uid())) then
    raise exception 'Only the person who paid can cancel this split' using errcode = '42501';
  end if;
  update public.split_bills set status = 'cancelled' where id = p_split_id;
  update public.obligations set status = 'waived', resolved_at = now()
  where split_id = p_split_id and status in ('owed', 'excuse_pending', 'disputed');
  -- The card in the chat shows it's cancelled
  update public.chat_messages set data = data || '{"cancelled": true}'::jsonb
  where id = (select message_id from public.split_bills where id = p_split_id);
end;
$$;

revoke execute on function public.create_split(uuid, text, int, uuid[], jsonb) from public, anon;
revoke execute on function public.get_split(uuid) from public, anon;
revoke execute on function public.cancel_split(uuid) from public, anon;
grant execute on function public.create_split(uuid, text, int, uuid[], jsonb) to authenticated;
grant execute on function public.get_split(uuid) to authenticated;
grant execute on function public.cancel_split(uuid) to authenticated;

notify pgrst, 'reload schema';
