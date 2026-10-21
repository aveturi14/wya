-- Stage 1.1: collect before you book (docs/split-app/STAGE_1_1_PLAN.md).
--
-- An organiser asks the event's guests for a fixed amount each ("$60 each for
-- karting, by Thursday 6pm, need at least 6"). Each person taps "I'm in" (their
-- consent, which creates a debt to the organiser), pays the organiser directly
-- by PayID and taps "I've paid"; the organiser confirms it arrived. Once enough
-- shares are CONFIRMED the collection is funded and the organiser books.
-- If the deadline passes first it expires and paid people are refunded by hand.
--
-- No money moves through wya. Collect debts reuse `obligations` (kind
-- 'collect') like splits do, with three differences:
--   * PayID only: never payable from the test-balance wallet (pay_from_wallet refuses);
--   * a debt exists only after that person joins (never because they were invited);
--   * "confirmed" (the organiser got it) and refunds are columns, not statuses,
--     so code that switches on `status` keeps working.
-- Like splits, collect debts never block RSVPs or count against reliability.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  -- The group is the event's guests
  event_id uuid not null references public.events on delete cascade,
  -- Who's collecting; the debts are owed to them
  organiser_id uuid not null references auth.users on delete cascade,
  title text not null check (length(title) between 1 and 80),
  merchant_note text check (merchant_note is null or length(merchant_note) <= 200),
  per_person_cents int not null check (per_person_cents between 100 and 500000),
  min_people int not null check (min_people between 1 and 200),
  -- Null: per_person_cents × min_people (private.collection_target)
  target_cents int check (target_cents is null or target_cents between 100 and 100000000),
  max_people int check (max_people is null or max_people between 1 and 200),
  deadline timestamptz not null,
  status text not null default 'open' check (status in ('open', 'funded', 'booked', 'expired', 'cancelled')),
  funded_at timestamptz,
  booked_at timestamptz,
  closed_at timestamptz,
  go_ahead_short boolean not null default false,
  message_id uuid references public.chat_messages on delete set null,
  created_at timestamptz not null default now(),
  check (max_people is null or max_people >= min_people)
);
create index if not exists collections_event_idx on public.collections (event_id);
create index if not exists collections_organiser_idx on public.collections (organiser_id);
-- One live collection per event at a time (C-4); also stops two creates racing
create unique index if not exists collections_one_live on public.collections (event_id) where status in ('open', 'funded');
alter table public.collections enable row level security;
revoke insert, update, delete on public.collections from anon, authenticated;

-- Each person's share is an obligation
alter table public.obligations add column if not exists collection_id uuid references public.collections on delete cascade;
-- The organiser confirmed it arrived (a claim alone is status 'paid')
alter table public.obligations add column if not exists confirmed_at timestamptz;
-- A paid share that has to go back: asked for by the payer, or because the collection expired or was cancelled
alter table public.obligations add column if not exists refund_requested_at timestamptz;
alter table public.obligations add column if not exists refunded_at timestamptz;
alter table public.obligations drop constraint if exists obligations_kind_check;
alter table public.obligations add constraint obligations_kind_check check (kind in ('pledge', 'split', 'collect'));
alter table public.obligations drop constraint if exists obligations_collect_shape;
alter table public.obligations add constraint obligations_collect_shape check ((kind = 'collect') = (collection_id is not null));
alter table public.obligations drop constraint if exists obligations_reason_check;
alter table public.obligations add constraint obligations_reason_check check (reason in ('no_show', 'late_cancel', 'shared_cost', 'collection'));
create unique index if not exists obligations_collect_unique on public.obligations (collection_id, guest_id) where collection_id is not null;

-- After obligations.collection_id exists. Reads go through get_collection anyway.
drop policy if exists "Organisers and guests see collections" on public.collections;
create policy "Organisers and guests see collections" on public.collections for select to authenticated
  using (organiser_id = (select auth.uid()) or private.is_event_guest(event_id));

-- Live progress on the collect page and card
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'collections') then
    alter publication supabase_realtime add table public.collections;
  end if;
  -- "Gary says he's paid" shows up on the organiser's page straight away (RLS still limits rows to the two people on a debt)
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'obligations') then
    alter publication supabase_realtime add table public.obligations;
  end if;
end $$;

-- Which reminders went out, so none repeats (section 5 of the plan)
create table if not exists private.collection_reminders (
  collection_id uuid not null references public.collections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- '24h', '2h', or 'confirm:<obligation id>' (the organiser, once per waiting share)
  slot text not null,
  sent_at timestamptz not null default now(),
  primary key (collection_id, user_id, slot)
);
alter table private.collection_reminders enable row level security;
revoke all on private.collection_reminders from public, anon, authenticated;

------------------------------------------------------------------------------
-- Chat card and Activity types
------------------------------------------------------------------------------
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'image', 'poll', 'split', 'plan', 'bot', 'system', 'receipt', 'collect'));

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
  'collect_expired', 'collect_cancelled', 'collect_refund_requested', 'collect_refunded', 'collect_reminder'
));

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
create or replace function private.collection_target(p public.collections)
returns int language sql immutable set search_path = '' as $$
  select coalesce(p.target_cents, p.per_person_cents * p.min_people);
$$;

-- A share that still counts: not on its way back to the payer
create or replace function private.collect_share_active(o public.obligations)
returns boolean language sql immutable set search_path = '' as $$
  select o.refund_requested_at is null and o.refunded_at is null;
$$;

-- Activity rows for a collection. data.title is the EVENT title (clear_test_notifications matches on it)
create or replace function private.notify_collection(
  p_collection_id uuid, p_to uuid[], p_type text, p_actor uuid, p_extra jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype;
begin
  select * into v from public.collections where id = p_collection_id;
  if v.id is null or p_to is null then return; end if;
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select distinct u, p_type, v.event_id, p_actor, jsonb_build_object(
    'title', (select e.title from public.events e where e.id = v.event_id),
    'collection_id', v.id, 'collection_title', v.title, 'amount_cents', v.per_person_cents,
    'organiser_name', (select p.full_name from public.profiles p where p.id = v.organiser_id),
    'actor_name', (select p.full_name from public.profiles p where p.id = p_actor),
    'deadline', v.deadline
  ) || coalesce(p_extra, '{}'::jsonb)
  from unnest(p_to) u
  where u is not null and u is distinct from p_actor;
end;
$$;

-- Everyone with an active share in it
create or replace function private.collection_members(p_collection_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.guest_id), '{}') from public.obligations o
  where o.collection_id = p_collection_id and private.collect_share_active(o);
$$;

-- Keep the chat card's status in step (the card re-reads get_collection on change)
create or replace function private.sync_collect_card(p_collection_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.chat_messages m set data = m.data || jsonb_build_object('status', c.status)
  from public.collections c
  where c.id = p_collection_id and m.id = c.message_id;
$$;

-- Funded = enough CONFIRMED shares (C-3). Called after every confirm, dispute, join and leave.
create or replace function private.check_collection_funding(p_collection_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.collections%rowtype;
  v_count int;
  v_cents bigint;
  v_met boolean;
begin
  select * into v from public.collections where id = p_collection_id for update;
  if v.id is null or v.status not in ('open', 'funded') then return; end if;
  select count(*), coalesce(sum(o.amount_cents), 0) into v_count, v_cents
  from public.obligations o
  where o.collection_id = v.id and o.status = 'paid' and o.confirmed_at is not null and private.collect_share_active(o);
  v_met := v_count >= v.min_people and v_cents >= private.collection_target(v);

  if v.status = 'open' and v_met then
    update public.collections set status = 'funded', funded_at = now() where id = v.id;
    perform private.notify_collection(v.id, array_append(private.collection_members(v.id), v.organiser_id), 'collect_funded', null);
    perform private.sync_collect_card(v.id);
  elsif v.status = 'funded' and not v_met and not v.go_ahead_short then
    -- A "Not received" or a refund request dropped it below the line before booking
    update public.collections set status = 'open', funded_at = null where id = v.id;
    perform private.notify_collection(v.id, array[v.organiser_id], 'collect_unfunded', null);
    perform private.sync_collect_card(v.id);
  end if;
end;
$$;

create or replace function private.collection_for_organiser(p_id uuid)
returns public.collections language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype;
begin
  select * into v from public.collections where id = p_id for update;
  if v.id is null or v.organiser_id is distinct from (select auth.uid()) then
    raise exception 'Only the organiser can do that' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- Unpaid shares go; paid ones are flagged to be refunded. Used by cancel and expiry.
create or replace function private.close_collection_shares(p_collection_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.obligations where collection_id = p_collection_id and status <> 'paid';
  update public.obligations set refund_requested_at = coalesce(refund_requested_at, now())
  where collection_id = p_collection_id and status = 'paid' and refunded_at is null;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.collection_target(public.collections)', 'private.collect_share_active(public.obligations)',
    'private.notify_collection(uuid, uuid[], text, uuid, jsonb)', 'private.collection_members(uuid)',
    'private.sync_collect_card(uuid)', 'private.check_collection_funding(uuid)',
    'private.collection_for_organiser(uuid)', 'private.close_collection_shares(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

------------------------------------------------------------------------------
-- Existing debt rules, for collect debts
------------------------------------------------------------------------------
-- "I've paid": pledges and collections (PayID). Bills and splits are paid from the wallet.
create or replace function public.claim_paid(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'guest');
begin
  if v.status = 'paid' then return; end if;  -- a double tap, or two devices: already done
  if v.kind = 'split' then
    raise exception 'Pay this one from your wya wallet' using errcode = 'P0001', hint = 'wallet_only';
  end if;
  if v.status not in ('owed', 'disputed') then raise exception 'Nothing to pay here' using errcode = 'P0001'; end if;
  update public.obligations set status = 'paid', paid_at = now(), paid_via = 'payid'
  where id = v.id and status in ('owed', 'disputed');
end;
$$;

-- "Not received". For a collection it also un-confirms the share, and may un-fund it.
create or replace function public.dispute_payment(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.status <> 'paid' then raise exception 'Only a payment marked as paid can be disputed' using errcode = 'P0001'; end if;
  if v.paid_via = 'wallet' then
    raise exception 'This was paid from their wya wallet, so it''s already in yours' using errcode = 'P0001', hint = 'wallet_paid';
  end if;
  if v.kind = 'collect' and v.refunded_at is not null then
    raise exception 'You''ve already refunded this one' using errcode = 'P0001', hint = 'already_refunded';
  end if;
  update public.obligations set status = 'disputed', paid_at = null, confirmed_at = null, refund_requested_at = null
  where id = v.id;
  if v.kind = 'collect' then
    perform private.check_collection_funding(v.collection_id);
  end if;
end;
$$;

-- Excuses and "let off" are pledge and split things; a collection share is left or refunded instead
create or replace function public.submit_excuse(p_obligation_id uuid, p_excuse text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'guest');
begin
  if v.kind = 'collect' then
    raise exception 'You can leave this collection instead' using errcode = 'P0001', hint = 'collect_leave';
  end if;
  if v.excuse is not null then raise exception 'You''ve already sent an excuse for this' using errcode = 'P0001'; end if;
  if v.status not in ('owed', 'disputed') then raise exception 'There''s nothing to excuse here' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_excuse, ''))) not between 1 and 500 then
    raise exception 'Write a short reason (up to 500 characters)' using errcode = '22023';
  end if;
  update public.obligations set status = 'excuse_pending', excuse = btrim(p_excuse) where id = v.id;
end;
$$;

create or replace function public.waive_obligation(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.kind = 'collect' then
    raise exception 'Cancel the collection, or mark the share refunded, instead' using errcode = 'P0001', hint = 'collect_not_waivable';
  end if;
  if v.status not in ('owed', 'excuse_pending', 'disputed') then raise exception 'This is already settled' using errcode = 'P0001'; end if;
  update public.obligations set status = 'waived', resolved_at = now() where id = v.id;
end;
$$;

-- Can't remove your PayID while people owe you, or while you're collecting
create or replace function public.remove_payid()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.obligations
    where host_id = (select auth.uid()) and status in ('owed', 'excuse_pending', 'disputed')
  ) or exists (
    select 1 from public.collections where organiser_id = (select auth.uid()) and status in ('open', 'funded')
  ) then
    raise exception 'People still owe you money, so your PayID can''t be removed yet. You can change it instead.' using errcode = '42501';
  end if;
  delete from public.payment_methods where user_id = (select auth.uid()) and provider = 'payid';
end;
$$;

-- Same as the wallet migration, plus: collection shares are PayID only (C-5)
create or replace function public.pay_from_wallet(p_obligation_id uuid, p_expected_cents int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.obligations%rowtype;
  v_balance int;
  v_txn uuid;
  v_desc text;
  v_to_name text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  -- Lock the debt first: two taps, or two devices, queue up here
  select * into v from public.obligations where id = p_obligation_id for update;
  if v.id is null or v.guest_id <> v_uid then
    raise exception 'Not found' using errcode = '42501';
  end if;
  if v.kind = 'collect' then
    raise exception 'Pay this one to the organiser by PayID' using errcode = 'P0001', hint = 'payid_only';
  end if;
  select full_name into v_to_name from public.profiles where id = v.host_id;

  -- Already paid from the wallet: a double tap. Report the payment that happened.
  if v.status = 'paid' and v.paid_via = 'wallet' then
    select id into v_txn from public.wallet_txns where obligation_id = v.id and kind = 'payment';
    return jsonb_build_object('already_paid', true, 'txn_id', v_txn, 'paid_to', v_to_name, 'paid_to_id', v.host_id,
      'amount_cents', v.amount_cents,
      'balance_after', coalesce((select balance_cents from public.wallets where user_id = v_uid), 0));
  end if;
  if v.status not in ('owed', 'disputed') then
    raise exception 'There''s nothing to pay on this one' using errcode = 'P0001', hint = 'not_payable';
  end if;
  -- The amount is the debt's. The caller only confirms the amount they were shown.
  if p_expected_cents is distinct from v.amount_cents then
    raise exception 'The amount changed to $%. Check it and pay again.', to_char(v.amount_cents / 100.0, 'FM999990.00')
      using errcode = 'P0001', hint = 'amount_changed';
  end if;

  perform private.ensure_wallet(v_uid);
  perform private.ensure_wallet(v.host_id);
  -- Lock both wallets, always in the same order, so two payments can't deadlock
  perform 1 from public.wallets where user_id in (v_uid, v.host_id) order by user_id for update;
  select balance_cents into v_balance from public.wallets where user_id = v_uid;
  if v_balance < v.amount_cents then
    raise exception 'You need $% more in your wallet', to_char((v.amount_cents - v_balance) / 100.0, 'FM999990.00')
      using errcode = 'P0001', hint = 'insufficient_funds', detail = (v.amount_cents - v_balance)::text;
  end if;

  select coalesce(sb.description, case when v.kind = 'pledge' then 'Pledge' else 'Shared cost' end) || ' · ' || e.title
    into v_desc
  from public.events e left join public.split_bills sb on sb.id = v.split_id
  where e.id = v.event_id;

  insert into public.wallet_txns (kind, amount_cents, created_by, to_user, obligation_id, description)
  values ('payment', v.amount_cents, v_uid, v.host_id, v.id, v_desc) returning id into v_txn;
  insert into public.wallet_entries (txn_id, user_id, amount_cents)
  values (v_txn, v_uid, -v.amount_cents), (v_txn, v.host_id, v.amount_cents);
  update public.wallets set balance_cents = balance_cents - v.amount_cents, updated_at = now() where user_id = v_uid
  returning balance_cents into v_balance;
  update public.wallets set balance_cents = balance_cents + v.amount_cents, updated_at = now() where user_id = v.host_id;
  update public.obligations set status = 'paid', paid_at = now(), paid_via = 'wallet' where id = v.id;

  return jsonb_build_object('already_paid', false, 'txn_id', v_txn, 'paid_to', v_to_name, 'paid_to_id', v.host_id,
    'amount_cents', v.amount_cents, 'balance_after', v_balance);
end;
$$;

-- Same as the wallet migration, plus collections: joining is your own tap (no row),
-- and "I've paid" on a collection tells the organiser as 'collect_paid'
create or replace function private.notify_obligation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text := (select title from public.events where id = new.event_id);
  v_guest text := (select full_name from public.profiles where id = new.guest_id);
  v_host text := (select full_name from public.profiles where id = new.host_id);
  v_what text := coalesce((select description from public.split_bills where id = new.split_id),
                          (select title from public.collections where id = new.collection_id));
  v_type text; v_to uuid; v_actor uuid; v_actor_name text;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'collect' then return new; end if;
    v_type := case when new.kind = 'split' then 'split_owed' else 'pledge_owed' end;
    v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  elsif new.status = old.status then
    return new;
  elsif new.status = 'paid' and new.paid_via = 'wallet' then
    v_type := 'wallet_paid'; v_to := new.host_id; v_actor := new.guest_id; v_actor_name := v_guest;
  elsif new.status = 'paid' then
    v_type := case when new.kind = 'collect' then 'collect_paid' else 'payment_claimed' end;
    v_to := new.host_id; v_actor := new.guest_id; v_actor_name := v_guest;
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
    'kind', new.kind, 'description', v_what, 'paid_via', new.paid_via,
    'collection_id', new.collection_id, 'collection_title', case when new.kind = 'collect' then v_what end
  ));
  return new;
end;
$$;

-- Every debt you're part of, now with the collection behind a collect share
drop function if exists public.get_my_obligations();
create function public.get_my_obligations()
returns table (
  id uuid, event_id uuid, event_title text, event_theme text, event_date timestamptz, role text,
  other_user_id uuid, other_name text, amount_cents int, currency text, reason text, status text,
  reference text, excuse text, excuse_declined boolean, created_at timestamptz, paid_at timestamptz,
  kind text, split_id uuid, description text, paid_via text,
  collection_id uuid, confirmed_at timestamptz, refund_requested_at timestamptz, refunded_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.title, e.theme, e.date,
         case when o.guest_id = (select auth.uid()) then 'guest' else 'host' end,
         case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end,
         p.full_name, o.amount_cents, o.currency, o.reason, o.status,
         o.reference, o.excuse, o.excuse_declined, o.created_at, o.paid_at,
         o.kind, o.split_id, coalesce(sb.description, c.title), o.paid_via,
         o.collection_id, o.confirmed_at, o.refund_requested_at, o.refunded_at
  from public.obligations o
  join public.events e on e.id = o.event_id
  left join public.split_bills sb on sb.id = o.split_id
  left join public.collections c on c.id = o.collection_id
  left join public.profiles p on p.id = case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end
  where o.guest_id = (select auth.uid()) or o.host_id = (select auth.uid())
  order by o.created_at desc;
$$;
revoke execute on function public.get_my_obligations() from public, anon;
grant execute on function public.get_my_obligations() to authenticated;

-- Your dues (bills, splits, pledges) leave collect shares out: those are paid by PayID
-- from the collect page, and every dues row offers "Pay from your wallet". Otherwise as in the wallet migration.
create or replace function public.get_my_dues(p_event_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_out jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  with debts as (
    -- Every debt the caller is part of (the owed side is `host_id`: host for a pledge, payer for a split)
    select o.id as obligation_id, o.event_id, o.kind as debt_kind, o.reason, o.status, o.amount_cents, o.created_at,
           o.paid_at, o.excuse_declined, o.paid_via,
           case when o.guest_id = v_uid then 'owe' else 'owed' end as direction,
           case when o.guest_id = v_uid then o.host_id else o.guest_id end as other_id,
           o.guest_id as debtor_id, o.split_id, sb.description as split_description,
           r.id as receipt_id, r.merchant
    from public.obligations o
    left join public.split_bills sb on sb.id = o.split_id
    left join public.receipts r on r.split_id = o.split_id and o.split_id is not null
    where (o.guest_id = v_uid or o.host_id = v_uid)
      and o.kind <> 'collect'
      and (p_event_id is null or o.event_id = p_event_id)
  ),
  debt_rows as (
    select jsonb_build_object(
      'key', 'debt:' || d.obligation_id,
      'kind', case when d.receipt_id is not null then 'bill' when d.debt_kind = 'split' then 'split' else 'pledge' end,
      'direction', d.direction,
      'state', d.status,
      'amount_cents', d.amount_cents,
      'other_id', d.other_id,
      'other_name', p.full_name,
      'other_avatar', p.avatar_url,
      'description', coalesce(d.split_description,
                              case d.reason when 'no_show' then 'Pledge: didn''t show'
                                            when 'late_cancel' then 'Pledge: cancelled after the cutoff'
                                            else 'Pledge' end),
      'merchant', d.merchant,
      'event_id', d.event_id, 'event_title', e.title, 'event_date', e.date, 'venue_name', e.venue_name, 'event_theme', e.theme,
      'obligation_id', d.obligation_id, 'receipt_id', d.receipt_id, 'split_id', d.split_id,
      'created_at', d.created_at, 'paid_at', d.paid_at, 'paid_via', d.paid_via,
      'split_people', case when d.debt_kind = 'split' and d.receipt_id is null
                           then (select count(*) + 1 from public.obligations x where x.split_id = d.split_id) end,
      'items', case when d.receipt_id is not null then private.receipt_person_items(d.receipt_id, d.debtor_id) end,
      'extras_cents', case when d.receipt_id is not null
                           then (select s.adjust_cents from private.receipt_shares(d.receipt_id) s where s.user_id = d.debtor_id) end
    ) as row
    from debts d
    join public.events e on e.id = d.event_id
    left join public.profiles p on p.id = d.other_id
  ),
  open_bills as (
    -- Bills still being claimed that the caller is part of
    select r.* from public.receipts r
    where r.status = 'claiming'
      and (p_event_id is null or r.event_id = p_event_id)
      and (r.payer_id = v_uid or private.is_going(r.event_id, v_uid))
  ),
  pending_rows as (
    -- My share so far, owed to the payer (an estimate until it's locked)
    select jsonb_build_object(
      'key', 'pending:' || b.id || ':' || v_uid,
      'kind', 'bill', 'direction', 'owe', 'state', 'pending',
      'amount_cents', coalesce(s.share_cents, 0),
      'other_id', b.payer_id, 'other_name', p.full_name, 'other_avatar', p.avatar_url,
      'description', b.description, 'merchant', b.merchant,
      'event_id', b.event_id, 'event_title', e.title, 'event_date', e.date, 'venue_name', e.venue_name, 'event_theme', e.theme,
      'receipt_id', b.id, 'created_at', b.created_at,
      'claimed', exists (select 1 from public.receipt_claims c where c.receipt_id = b.id and c.user_id = v_uid),
      'confirmed', exists (select 1 from public.receipt_confirmations c
                           where c.receipt_id = b.id and c.user_id = v_uid and c.share_cents = s.share_cents),
      'items', private.receipt_person_items(b.id, v_uid),
      'extras_cents', s.adjust_cents
    ) as row
    from open_bills b
    join public.events e on e.id = b.event_id
    left join public.profiles p on p.id = b.payer_id
    left join lateral (select x.share_cents, x.adjust_cents from private.receipt_shares(b.id) x where x.user_id = v_uid) s on true
    where b.payer_id <> v_uid
    union all
    -- The payer: what each person's share is so far
    select jsonb_build_object(
      'key', 'pending:' || b.id || ':' || s.user_id,
      'kind', 'bill', 'direction', 'owed', 'state', 'pending',
      'amount_cents', s.share_cents,
      'other_id', s.user_id, 'other_name', p.full_name, 'other_avatar', p.avatar_url,
      'description', b.description, 'merchant', b.merchant,
      'event_id', b.event_id, 'event_title', e.title, 'event_date', e.date, 'venue_name', e.venue_name, 'event_theme', e.theme,
      'receipt_id', b.id, 'created_at', b.created_at,
      'claimed', true,
      'confirmed', exists (select 1 from public.receipt_confirmations c
                           where c.receipt_id = b.id and c.user_id = s.user_id and c.share_cents = s.share_cents),
      'items', private.receipt_person_items(b.id, s.user_id),
      'extras_cents', s.adjust_cents
    ) as row
    from open_bills b
    join public.events e on e.id = b.event_id
    cross join lateral private.receipt_shares(b.id) s
    left join public.profiles p on p.id = s.user_id
    where b.payer_id = v_uid and s.user_id <> v_uid and s.share_cents > 0
  )
  select coalesce(jsonb_agg(x.row order by (x.row->>'created_at') desc), '[]'::jsonb) into v_out
  from (select row from debt_rows union all select row from pending_rows) x;
  return v_out;
end;
$$;

-- Chats tab preview for the new card (same as the receipts migration otherwise)
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
    where e.host_id = (select auth.uid())
       or exists (
         select 1 from public.rsvps r
         where r.event_id = e.id and r.user_id = (select auth.uid()) and r.status in ('yes', 'maybe')
       )
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

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
-- Start collecting (C-1: the host or a Going guest). Needs a PayID: that's where the money goes.
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
  if p_per_person_cents is null or p_per_person_cents not between 100 and 500000 then
    raise exception 'Each person''s amount must be between $1 and $5,000' using errcode = '22023', hint = 'amount';
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
                                    target_cents, max_people, deadline)
    values (p_event_id, v_uid, v_title, v_note, p_per_person_cents, p_min_people, p_target_cents, p_max_people, p_deadline)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'There''s already a collection going on this event' using errcode = 'P0001', hint = 'already_collecting';
  end;

  v_message := private.post_message(p_event_id, v_uid, 'collect', null, jsonb_build_object(
    'collection_id', v_id, 'title', v_title, 'per_person_cents', p_per_person_cents,
    'deadline', p_deadline, 'status', 'open'
  ));
  update public.collections set message_id = v_message where id = v_id;

  -- Tell the event's people (not those waiting to be let in, or who said no)
  select array_agg(x) into v_guests from (
    select v_event.host_id as x
    union
    select r.user_id from public.rsvps r where r.event_id = p_event_id and r.status not in ('requested', 'no')
  ) people;
  perform private.notify_collection(v_id, v_guests, 'collect_started', v_uid);
  return v_id;
end;
$$;

-- Everything the collect page shows. PayIDs never appear here (they come from
-- get_payment_instructions, to the payer only, while they owe).
create or replace function public.get_collection(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_org boolean;
  v_mine public.obligations%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v from public.collections where id = p_id;
  if v.id is null or not (v.organiser_id = v_uid or private.is_event_guest(v.event_id)
                          or exists (select 1 from public.obligations o where o.collection_id = v.id and o.guest_id = v_uid)) then
    raise exception 'Ask the organiser for the invite link' using errcode = '42501', hint = 'not_a_guest';
  end if;
  v_org := v.organiser_id = v_uid;
  select * into v_mine from public.obligations where collection_id = v.id and guest_id = v_uid;

  return jsonb_build_object(
    'id', v.id, 'event_id', v.event_id,
    'event_title', (select e.title from public.events e where e.id = v.event_id),
    'event_date', (select e.date from public.events e where e.id = v.event_id),
    'event_theme', (select e.theme from public.events e where e.id = v.event_id),
    'organiser_id', v.organiser_id,
    'organiser_name', (select p.full_name from public.profiles p where p.id = v.organiser_id),
    'organiser_avatar', (select p.avatar_url from public.profiles p where p.id = v.organiser_id),
    'title', v.title, 'merchant_note', v.merchant_note,
    'per_person_cents', v.per_person_cents, 'min_people', v.min_people, 'max_people', v.max_people,
    'target_cents', private.collection_target(v), 'deadline', v.deadline, 'status', v.status,
    'funded_at', v.funded_at, 'booked_at', v.booked_at, 'closed_at', v.closed_at,
    'go_ahead_short', v.go_ahead_short, 'created_at', v.created_at,
    'is_organiser', v_org,
    'can_join', not v_org and v.status = 'open' and v.deadline > now() and private.is_event_guest(v.event_id)
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
        'refunds_due', count(*) filter (where o.status = 'paid' and o.refund_requested_at is not null and o.refunded_at is null)
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
        -- The organiser acts on each share; everyone else only on their own
        'obligation_id', case when v_org or o.guest_id = v_uid then o.id end,
        'joined_at', o.created_at, 'paid_at', o.paid_at, 'confirmed_at', o.confirmed_at
      ) order by o.created_at)
      from public.obligations o left join public.profiles p on p.id = o.guest_id
      where o.collection_id = v.id
    ), '[]'::jsonb),
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

-- "I'm in, $60": the person's consent, and their debt to the organiser. Idempotent.
create or replace function public.join_collection(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  v_existing public.obligations%rowtype;
  v_ob uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  -- Locked, so the last places can't be taken twice
  select * into v from public.collections where id = p_id for update;
  if v.id is null or not private.is_event_guest(v.event_id) then
    raise exception 'Ask the organiser for the invite link' using errcode = '42501', hint = 'not_a_guest';
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
  if v.status <> 'open' or v.deadline <= now() then
    raise exception 'This collection isn''t taking people any more' using errcode = 'P0001', hint = 'not_open';
  end if;
  if v.max_people is not null and cardinality(private.collection_members(v.id)) >= v.max_people then
    raise exception 'It''s full' using errcode = 'P0001', hint = 'full';
  end if;
  insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason, kind, collection_id)
  values (v.event_id, v_uid, v.organiser_id, v.per_person_cents, 'collection', 'collect', v.id)
  returning id into v_ob;
  perform private.check_collection_funding(v.id);
  return v_ob;
end;
$$;

-- Before paying: you're out. After paying: you're asking for your money back.
create or replace function public.leave_collection(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.collections%rowtype;
  o public.obligations%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v from public.collections where id = p_id for update;
  select * into o from public.obligations where collection_id = p_id and guest_id = v_uid;
  if v.id is null or o.id is null then
    raise exception 'You''re not in this one' using errcode = '42501';
  end if;
  if o.status <> 'paid' then
    delete from public.obligations where id = o.id;
    perform private.check_collection_funding(v.id);
    return 'left';
  end if;
  if o.refunded_at is not null then return 'refunded'; end if;
  if o.refund_requested_at is null then
    update public.obligations set refund_requested_at = now() where id = o.id;
    perform private.notify_collection(v.id, array[v.organiser_id], 'collect_refund_requested', v_uid,
      jsonb_build_object('obligation_id', o.id));
    perform private.check_collection_funding(v.id);
  end if;
  return 'refund_requested';
end;
$$;

-- "Got it": the organiser saw the money arrive
create or replace function public.confirm_received(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.kind <> 'collect' then
    raise exception 'Only collection payments are confirmed' using errcode = 'P0001', hint = 'not_collect';
  end if;
  if v.status <> 'paid' then
    raise exception 'They haven''t said they''ve paid yet' using errcode = 'P0001', hint = 'not_claimed';
  end if;
  if v.confirmed_at is not null then return; end if;
  update public.obligations set confirmed_at = now() where id = v.id;
  perform private.notify_collection(v.collection_id, array[v.guest_id], 'collect_confirmed', v.host_id,
    jsonb_build_object('obligation_id', v.id));
  perform private.check_collection_funding(v.collection_id);
end;
$$;

-- "Refunded": the organiser sent a paid share back (C-9: manual)
create or replace function public.mark_refunded(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
  v_status text;
begin
  if v.kind <> 'collect' then
    raise exception 'Only collection payments are refunded here' using errcode = 'P0001', hint = 'not_collect';
  end if;
  if v.refunded_at is not null then return; end if;
  select status into v_status from public.collections where id = v.collection_id;
  if v.status <> 'paid' or (v.refund_requested_at is null and v_status not in ('expired', 'cancelled')) then
    raise exception 'There''s nothing to refund on this one' using errcode = 'P0001', hint = 'not_refundable';
  end if;
  update public.obligations set refunded_at = now(), refund_requested_at = coalesce(refund_requested_at, now()) where id = v.id;
  perform private.notify_collection(v.collection_id, array[v.guest_id], 'collect_refunded', v.host_id,
    jsonb_build_object('obligation_id', v.id));
  perform private.check_collection_funding(v.collection_id);
end;
$$;

-- C-8: going ahead short is the organiser's explicit choice, never automatic
create or replace function public.go_ahead_anyway(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype := private.collection_for_organiser(p_id);
begin
  if v.status <> 'open' then
    raise exception 'This collection isn''t open' using errcode = 'P0001', hint = 'not_open';
  end if;
  if not exists (select 1 from public.obligations o where o.collection_id = v.id and o.status = 'paid'
                 and o.confirmed_at is not null and private.collect_share_active(o)) then
    raise exception 'Confirm at least one payment first' using errcode = 'P0001', hint = 'none_confirmed';
  end if;
  update public.collections set go_ahead_short = true, status = 'funded', funded_at = now() where id = v.id;
  perform private.notify_collection(v.id, private.collection_members(v.id), 'collect_funded', v.organiser_id,
    jsonb_build_object('short', true));
  perform private.sync_collect_card(v.id);
end;
$$;

create or replace function public.mark_booked(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype := private.collection_for_organiser(p_id);
begin
  if v.status = 'booked' then return; end if;
  if v.status <> 'funded' then
    raise exception 'It has to be funded before you book' using errcode = 'P0001', hint = 'not_funded';
  end if;
  update public.collections set status = 'booked', booked_at = now() where id = v.id;
  perform private.notify_collection(v.id, private.collection_members(v.id), 'collect_booked', v.organiser_id);
  perform private.sync_collect_card(v.id);
end;
$$;

create or replace function public.extend_deadline(p_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.collections%rowtype := private.collection_for_organiser(p_id);
begin
  if v.status <> 'open' then
    raise exception 'Only an open collection can be extended' using errcode = 'P0001', hint = 'not_open';
  end if;
  if p_deadline is null or p_deadline <= v.deadline or p_deadline <= now() or p_deadline > now() + interval '60 days' then
    raise exception 'Pick a later deadline, in the next 60 days' using errcode = '22023', hint = 'deadline';
  end if;
  update public.collections set deadline = p_deadline where id = v.id;
  update public.chat_messages set data = data || jsonb_build_object('deadline', p_deadline) where id = v.message_id;
  -- New windows for the reminders
  delete from private.collection_reminders where collection_id = v.id and slot in ('24h', '2h');
end;
$$;

create or replace function public.cancel_collection(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.collections%rowtype := private.collection_for_organiser(p_id);
  v_people uuid[];
begin
  if v.status = 'cancelled' then return; end if;
  if v.status not in ('open', 'funded') then
    raise exception 'This collection can''t be cancelled now' using errcode = 'P0001', hint = 'not_cancellable';
  end if;
  select coalesce(array_agg(guest_id), '{}') into v_people from public.obligations where collection_id = v.id;
  update public.collections set status = 'cancelled', closed_at = now() where id = v.id;
  perform private.close_collection_shares(v.id);
  perform private.notify_collection(v.id, v_people, 'collect_cancelled', v.organiser_id);
  perform private.sync_collect_card(v.id);
end;
$$;

-- What I'm organising, what I've joined, and open ones on my events I could join (Home / Needs you)
create or replace function public.get_my_collections()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row order by (row->>'deadline')), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.id, 'event_id', c.event_id, 'event_title', e.title, 'title', c.title, 'status', c.status,
      'deadline', c.deadline, 'per_person_cents', c.per_person_cents, 'min_people', c.min_people,
      'target_cents', private.collection_target(c),
      'organiser_id', c.organiser_id, 'organiser_name', op.full_name,
      'role', case when c.organiser_id = (select auth.uid()) then 'organiser' when o.id is not null then 'member' else 'can_join' end,
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
                      and x.refund_requested_at is not null and x.refunded_at is null)
    ) as row
    from public.collections c
    join public.events e on e.id = c.event_id
    left join public.profiles op on op.id = c.organiser_id
    left join public.obligations o on o.collection_id = c.id and o.guest_id = (select auth.uid())
    where c.organiser_id = (select auth.uid())
       or o.id is not null
       or (c.status = 'open' and c.deadline > now() and private.is_event_guest(c.event_id))
  ) x;
$$;

-- Reminders and expiry. Runs every 15 minutes; safe to call any time (it only
-- acts on what's already due, and each reminder goes out once).
create or replace function public.process_collection_deadlines()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reminded int := 0;
  v_expired int := 0;
  r record;
  v_people uuid[];
  v_waiting jsonb;
begin
  -- People who are in but haven't paid: 24 hours out, then 2 hours out
  with due as (
    insert into private.collection_reminders (collection_id, user_id, slot)
    select c.id, o.guest_id, case when c.deadline - now() <= interval '2 hours' then '2h' else '24h' end
    from public.collections c
    join public.obligations o on o.collection_id = c.id and o.status in ('owed', 'disputed')
    where c.status = 'open' and c.deadline > now() and c.deadline - now() <= interval '24 hours'
    on conflict do nothing
    returning collection_id, user_id, slot
  )
  select coalesce(jsonb_agg(jsonb_build_object('c', collection_id, 'u', user_id, 's', slot)), '[]'::jsonb) into v_waiting from due;
  for r in
    select (x->>'c')::uuid as collection_id, (x->>'u')::uuid as user_id, x->>'s' as slot
    from jsonb_array_elements(v_waiting) x
  loop
    perform private.notify_collection(r.collection_id, array[r.user_id], 'collect_reminder', null,
      jsonb_build_object('slot', r.slot));
    v_reminded := v_reminded + 1;
  end loop;

  -- Organisers with payments waiting over 12 hours for "Got it": once per waiting share, one row per collection
  -- (Collected first: a loop can't run over an INSERT … RETURNING)
  with due as (
    insert into private.collection_reminders (collection_id, user_id, slot)
    select c.id, c.organiser_id, 'confirm:' || o.id
    from public.collections c
    join public.obligations o on o.collection_id = c.id and o.status = 'paid' and o.confirmed_at is null
      and o.refunded_at is null and o.paid_at < now() - interval '12 hours'
    where c.status in ('open', 'funded', 'booked')
    on conflict do nothing
    returning collection_id, user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('c', collection_id, 'u', user_id, 'n', n)), '[]'::jsonb) into v_waiting
  from (select collection_id, user_id, count(*) as n from due group by collection_id, user_id) g;
  for r in
    select (x->>'c')::uuid as collection_id, (x->>'u')::uuid as user_id, (x->>'n')::int as n
    from jsonb_array_elements(v_waiting) x
  loop
    perform private.notify_collection(r.collection_id, array[r.user_id], 'collect_reminder', null,
      jsonb_build_object('slot', 'confirm', 'waiting', r.n));
    v_reminded := v_reminded + 1;
  end loop;

  -- Past the deadline without being funded: expired. Unpaid shares go; paid ones are owed back.
  for r in
    select id, organiser_id from public.collections where status = 'open' and deadline <= now() for update skip locked
  loop
    select coalesce(array_agg(guest_id), '{}') into v_people from public.obligations where collection_id = r.id;
    update public.collections set status = 'expired', closed_at = now() where id = r.id;
    perform private.close_collection_shares(r.id);
    perform private.notify_collection(r.id, array_append(v_people, r.organiser_id), 'collect_expired', null,
      jsonb_build_object('refunds_due', (select count(*) from public.obligations o where o.collection_id = r.id
                                         and o.status = 'paid' and o.refunded_at is null)));
    perform private.sync_collect_card(r.id);
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('reminded', v_reminded, 'expired', v_expired);
end;
$$;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wya-collection-deadlines';
  perform cron.schedule('wya-collection-deadlines', '*/15 * * * *', 'select public.process_collection_deadlines()');
end $$;

------------------------------------------------------------------------------
-- Is 1.1 working? Service role only; real accounts only (not @wya.test).
--   select public.get_collect_stats();   -- in the SQL editor, or with the service key
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
  )
  select jsonb_build_object(
    'collections', (select count(*) from c),
    'funded_by_deadline_pct', round(100.0 * (select count(*) from c where c.funded_at is not null and c.funded_at <= c.deadline)
                                     / nullif((select count(*) from c where c.status <> 'open' or c.deadline <= now()), 0), 1),
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
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from c group by status) x)
  );
$$;
revoke execute on function public.get_collect_stats() from public, anon, authenticated;
grant execute on function public.get_collect_stats() to service_role;

------------------------------------------------------------------------------
-- Who may call what
------------------------------------------------------------------------------
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.create_collection(uuid, text, int, int, timestamptz, int, int, text)',
    'public.get_collection(uuid)',
    'public.join_collection(uuid)',
    'public.leave_collection(uuid)',
    'public.confirm_received(uuid)',
    'public.mark_refunded(uuid)',
    'public.go_ahead_anyway(uuid)',
    'public.mark_booked(uuid)',
    'public.extend_deadline(uuid, timestamptz)',
    'public.cancel_collection(uuid)',
    'public.get_my_collections()',
    -- Like process_pledge_deadlines: only acts on what's already due (the tests call it)
    'public.process_collection_deadlines()',
    'public.claim_paid(uuid)', 'public.dispute_payment(uuid)', 'public.submit_excuse(uuid, text)',
    'public.waive_obligation(uuid)', 'public.remove_payid()', 'public.pay_from_wallet(uuid, int)',
    'public.get_my_dues(uuid)', 'public.get_my_chats()'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
