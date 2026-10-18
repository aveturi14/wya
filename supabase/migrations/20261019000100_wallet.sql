-- Phase 9.11 (test balance): the wya wallet.
--
-- A wallet per person, a double-entry ledger, saved payment methods (display
-- details only) and paying a debt from the wallet. Money here is a TEST
-- BALANCE: top-ups (card / Apple Pay, mocked in the app) add test dollars while
-- private.wallet_config.test_mode is on. Real top-ups come with a licensed
-- payments partner (docs/PHASE9.md 9.10, 9.12).
--
-- The rules that make it safe:
--   * No table is writable by anyone; every movement goes through a function.
--   * pay_from_wallet pays exactly one debt: only its debtor can call it, the
--     amount is the debt's amount (the caller only confirms what they saw), the
--     money goes to whoever is owed on that row, and a debt can be paid once
--     (unique index). There is no "send money to someone" function.
--   * Every movement is two ledger rows that sum to zero, written together,
--     and a balance can never go below zero.
--   * Bill and split debts are wallet only: "I've paid" (claim_paid) is refused
--     for them, and a wallet payment can't be disputed as "not received".
--   * Bills no longer need the payer to have a PayID (the wallet receives).
-- Safe to re-run.

------------------------------------------------------------------------------
-- Settings: test mode (a production migration turns this off)
------------------------------------------------------------------------------
create table if not exists private.wallet_config (
  id boolean primary key default true check (id),
  test_mode boolean not null default true,
  max_topup_cents int not null default 50000,
  max_balance_cents int not null default 50000,
  monthly_topup_cents int not null default 100000
);
insert into private.wallet_config (id) values (true) on conflict do nothing;
revoke all on private.wallet_config from public, anon, authenticated;

------------------------------------------------------------------------------
-- Tables (read your own; nobody writes directly)
------------------------------------------------------------------------------
create table if not exists public.wallets (
  user_id uuid primary key references auth.users on delete cascade,
  balance_cents int not null default 0 check (balance_cents >= 0),
  currency text not null default 'AUD',
  -- Test accounts only: when reset_test_wallet last emptied it (the monthly top-up count restarts)
  test_reset_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.wallets add column if not exists test_reset_at timestamptz;

-- What's shown for a saved way to top up. Never a full card number or a CVC.
create table if not exists public.wallet_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('card', 'apple_pay')),
  brand text check (brand in ('visa', 'mastercard', 'amex', 'card')),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  exp_month int check (exp_month between 1 and 12),
  exp_year int check (exp_year between 2000 and 2100),
  label text check (label is null or length(label) <= 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind = 'apple_pay' or (brand is not null and last4 is not null and exp_month is not null and exp_year is not null))
);
create unique index if not exists wallet_methods_one_default on public.wallet_methods (user_id) where is_default;
create unique index if not exists wallet_methods_one_apple_pay on public.wallet_methods (user_id) where kind = 'apple_pay';

create table if not exists public.wallet_txns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('topup', 'payment', 'test_reset')),
  amount_cents int not null check (amount_cents > 0),
  created_by uuid not null references auth.users on delete cascade,
  -- payment: who was paid (the debt's creditor)
  to_user uuid references auth.users on delete set null,
  obligation_id uuid references public.obligations on delete set null,
  method_id uuid references public.wallet_methods on delete set null,
  -- Copied at the time, so history still reads well if the event or debt is deleted
  description text,
  created_at timestamptz not null default now()
);
-- A debt can be paid from a wallet once, ever
alter table public.wallet_txns drop constraint if exists wallet_txns_kind_check;
alter table public.wallet_txns add constraint wallet_txns_kind_check check (kind in ('topup', 'payment', 'test_reset'));
create unique index if not exists wallet_txns_one_payment on public.wallet_txns (obligation_id) where kind = 'payment' and obligation_id is not null;
create index if not exists wallet_txns_created_by_idx on public.wallet_txns (created_by, created_at desc);
create index if not exists wallet_txns_to_user_idx on public.wallet_txns (to_user, created_at desc);

-- The ledger: each txn writes rows that sum to zero. user_id null = money from outside (top-ups)
create table if not exists public.wallet_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null references public.wallet_txns on delete cascade,
  user_id uuid references auth.users on delete cascade,
  amount_cents int not null check (amount_cents <> 0),
  created_at timestamptz not null default now()
);
create index if not exists wallet_entries_user_idx on public.wallet_entries (user_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_methods enable row level security;
alter table public.wallet_txns enable row level security;
alter table public.wallet_entries enable row level security;
revoke insert, update, delete on public.wallets, public.wallet_methods, public.wallet_txns, public.wallet_entries from anon, authenticated;
drop policy if exists "Own wallet" on public.wallets;
create policy "Own wallet" on public.wallets for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Own methods" on public.wallet_methods;
create policy "Own methods" on public.wallet_methods for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Own movements" on public.wallet_txns;
create policy "Own movements" on public.wallet_txns for select to authenticated
  using (created_by = (select auth.uid()) or to_user = (select auth.uid()));
drop policy if exists "Own ledger rows" on public.wallet_entries;
create policy "Own ledger rows" on public.wallet_entries for select to authenticated using (user_id = (select auth.uid()));

-- Live balance on the wallet page
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets') then
    alter publication supabase_realtime add table public.wallets;
  end if;
end $$;

alter table public.obligations add column if not exists paid_via text;
alter table public.obligations drop constraint if exists obligations_paid_via_check;
alter table public.obligations add constraint obligations_paid_via_check check (paid_via is null or paid_via in ('payid', 'wallet'));

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
create or replace function private.ensure_wallet(p_uid uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallets (user_id) values (p_uid) on conflict do nothing;
$$;
revoke execute on function private.ensure_wallet(uuid) from public, anon, authenticated;

create or replace function private.method_label(p_method public.wallet_methods)
returns text language sql immutable set search_path = '' as $$
  select case when p_method.id is null then null
              when p_method.kind = 'apple_pay' then 'Apple Pay'
              else initcap(p_method.brand) || ' ••' || p_method.last4 end;
$$;
revoke execute on function private.method_label(public.wallet_methods) from public, anon, authenticated;

-- The monthly top-up limit counts from the start of the month (or a test reset, if later)
create or replace function private.topup_month_start(p_uid uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select greatest(date_trunc('month', now()), coalesce((select test_reset_at from public.wallets where user_id = p_uid), '-infinity'::timestamptz));
$$;
revoke execute on function private.topup_month_start(uuid) from public, anon, authenticated;

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
-- Your wallet: balance, limits, methods and recent movements, ready to show
create or replace function public.get_my_wallet()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cfg private.wallet_config%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v_cfg from private.wallet_config where id;
  return jsonb_build_object(
    'balance_cents', coalesce((select balance_cents from public.wallets where user_id = v_uid), 0),
    'currency', 'AUD',
    'test_mode', coalesce(v_cfg.test_mode, false),
    'limits', jsonb_build_object(
      'max_topup_cents', v_cfg.max_topup_cents, 'max_balance_cents', v_cfg.max_balance_cents,
      'monthly_topup_cents', v_cfg.monthly_topup_cents,
      'topped_up_this_month_cents', (select coalesce(sum(t.amount_cents), 0) from public.wallet_txns t
                                     where t.created_by = v_uid and t.kind = 'topup' and t.created_at >= private.topup_month_start(v_uid))),
    'methods', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'brand', m.brand, 'last4', m.last4, 'exp_month', m.exp_month, 'exp_year', m.exp_year,
        'label', coalesce(m.label, private.method_label(m)), 'is_default', m.is_default
      ) order by m.is_default desc, m.created_at) from public.wallet_methods m where m.user_id = v_uid), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(a order by a->>'created_at' desc) from (
        select jsonb_build_object(
          'id', t.id, 'kind', t.kind, 'created_at', t.created_at,
          'amount_cents', e.amount_cents,
          'direction', case when e.amount_cents > 0 then 'in' else 'out' end,
          'title', case
              when t.kind = 'topup' then 'Topped up'
              when t.kind = 'test_reset' then 'Test balance reset'
              when e.amount_cents < 0 then 'Paid ' || coalesce(split_part(pt.full_name, ' ', 1), 'someone')
              else coalesce(split_part(pf.full_name, ' ', 1), 'Someone') || ' paid you' end,
          'subtitle', case when t.kind = 'topup' then coalesce(private.method_label(m), 'Test top-up') else t.description end,
          'other_id', case when t.kind = 'payment' then case when e.amount_cents < 0 then t.to_user else t.created_by end end,
          'other_name', case when t.kind = 'payment' then case when e.amount_cents < 0 then pt.full_name else pf.full_name end end,
          'obligation_id', t.obligation_id
        ) as a
        from public.wallet_entries e
        join public.wallet_txns t on t.id = e.txn_id
        left join public.wallet_methods m on m.id = t.method_id
        left join public.profiles pt on pt.id = t.to_user
        left join public.profiles pf on pf.id = t.created_by
        where e.user_id = v_uid
        order by e.created_at desc
        limit 50
      ) x), '[]'::jsonb)
  );
end;
$$;

-- Save a way to top up. Only what's needed to show it: brand, last 4, expiry.
create or replace function public.add_wallet_method(
  p_kind text, p_brand text default null, p_last4 text default null,
  p_exp_month int default null, p_exp_year int default null, p_label text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_kind not in ('card', 'apple_pay') then raise exception 'Unknown payment method' using errcode = '22023'; end if;
  if p_kind = 'apple_pay' then
    select id into v_id from public.wallet_methods where user_id = v_uid and kind = 'apple_pay';
    if v_id is not null then return v_id; end if;
  else
    if p_brand not in ('visa', 'mastercard', 'amex', 'card') or p_last4 !~ '^[0-9]{4}$' then
      raise exception 'That card doesn''t look right' using errcode = '22023', hint = 'card_invalid';
    end if;
    if p_exp_month not between 1 and 12 or p_exp_year is null
       or make_date(p_exp_year, p_exp_month, 1) + interval '1 month' <= date_trunc('month', now()) then
      raise exception 'That card has expired' using errcode = '22023', hint = 'card_expired';
    end if;
  end if;
  if (select count(*) from public.wallet_methods where user_id = v_uid) >= 5 then
    raise exception 'You can save up to 5 ways to pay' using errcode = 'P0001', hint = 'too_many_methods';
  end if;
  perform private.hit_rate_limit('wallet_method:' || v_uid, 20, interval '1 hour');
  insert into public.wallet_methods (user_id, kind, brand, last4, exp_month, exp_year, label, is_default)
  values (v_uid, p_kind, case when p_kind = 'card' then p_brand end, case when p_kind = 'card' then p_last4 end,
          case when p_kind = 'card' then p_exp_month end, case when p_kind = 'card' then p_exp_year end,
          nullif(left(btrim(coalesce(p_label, '')), 40), ''),
          not exists (select 1 from public.wallet_methods where user_id = v_uid))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_wallet_method(p_method_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_was_default boolean;
begin
  delete from public.wallet_methods where id = p_method_id and user_id = (select auth.uid())
  returning is_default into v_was_default;
  -- Keep one default while any are left
  if v_was_default then
    update public.wallet_methods set is_default = true
    where id = (select id from public.wallet_methods where user_id = (select auth.uid()) order by created_at limit 1);
  end if;
end;
$$;

create or replace function public.set_default_method(p_method_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wallet_methods where id = p_method_id and user_id = (select auth.uid())) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  update public.wallet_methods set is_default = false where user_id = (select auth.uid()) and is_default;
  update public.wallet_methods set is_default = true where id = p_method_id;
end;
$$;

-- Add test money (test mode only), as if a saved card or Apple Pay had been charged
create or replace function public.test_topup(p_cents int, p_method_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cfg private.wallet_config%rowtype;
  v_balance int;
  v_month bigint;
  v_txn uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v_cfg from private.wallet_config where id;
  if not coalesce(v_cfg.test_mode, false) then
    raise exception 'Top-ups aren''t available yet' using errcode = 'P0001', hint = 'topup_unavailable';
  end if;
  if not exists (select 1 from public.wallet_methods where id = p_method_id and user_id = v_uid) then
    raise exception 'Choose one of your saved ways to pay' using errcode = '42501', hint = 'method_not_yours';
  end if;
  if p_cents is null or p_cents < 100 or p_cents > v_cfg.max_topup_cents then
    raise exception 'Top up between $1 and $%', v_cfg.max_topup_cents / 100 using errcode = '22023', hint = 'topup_amount';
  end if;
  perform private.ensure_wallet(v_uid);
  select balance_cents into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance + p_cents > v_cfg.max_balance_cents then
    raise exception 'Your wallet can hold up to $% (you have $%)', v_cfg.max_balance_cents / 100, to_char(v_balance / 100.0, 'FM999990.00')
      using errcode = 'P0001', hint = 'balance_limit';
  end if;
  select coalesce(sum(amount_cents), 0) into v_month from public.wallet_txns
  where created_by = v_uid and kind = 'topup' and created_at >= private.topup_month_start(v_uid);
  if v_month + p_cents > v_cfg.monthly_topup_cents then
    raise exception 'That''s over the $% a month top-up limit', v_cfg.monthly_topup_cents / 100 using errcode = 'P0001', hint = 'monthly_limit';
  end if;
  perform private.hit_rate_limit('topup:' || v_uid, 20, interval '1 hour');

  insert into public.wallet_txns (kind, amount_cents, created_by, method_id, description)
  values ('topup', p_cents, v_uid, p_method_id, 'Test top-up') returning id into v_txn;
  insert into public.wallet_entries (txn_id, user_id, amount_cents) values (v_txn, null, -p_cents), (v_txn, v_uid, p_cents);
  update public.wallets set balance_cents = balance_cents + p_cents, updated_at = now() where user_id = v_uid
  returning balance_cents into v_balance;
  return jsonb_build_object('balance_cents', v_balance, 'txn_id', v_txn);
end;
$$;

-- Pay one debt from your wallet. Exactly that debt, by its debtor, to its creditor, once.
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

-- Test accounts only: empty your test wallet, so the automated checks can run again and again.
-- Recorded in the ledger like anything else (the money goes back to "outside").
create or replace function public.reset_test_wallet()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_balance int;
  v_txn uuid;
begin
  if not coalesce((select test_mode from private.wallet_config where id), false)
     or not exists (select 1 from auth.users where id = v_uid and email like '%@wya.test') then
    raise exception 'Only test accounts can reset their wallet' using errcode = '42501';
  end if;
  perform private.ensure_wallet(v_uid);
  select balance_cents into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance > 0 then
    insert into public.wallet_txns (kind, amount_cents, created_by, description)
    values ('test_reset', v_balance, v_uid, 'Test balance reset') returning id into v_txn;
    insert into public.wallet_entries (txn_id, user_id, amount_cents) values (v_txn, v_uid, -v_balance), (v_txn, null, v_balance);
  end if;
  update public.wallets set balance_cents = 0, test_reset_at = now(), updated_at = now() where user_id = v_uid;
end;
$$;

------------------------------------------------------------------------------
-- Existing debt rules, for the wallet
------------------------------------------------------------------------------
-- "I've paid" stays for pledges paid by PayID. Bills and splits are paid from the wallet.
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

-- A wallet payment is on the ledger, so it can't be disputed as "not received"
create or replace function public.dispute_payment(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.status <> 'paid' then raise exception 'Only a payment marked as paid can be disputed' using errcode = 'P0001'; end if;
  if v.paid_via = 'wallet' then
    raise exception 'This was paid from their wya wallet, so it''s already in yours' using errcode = 'P0001', hint = 'wallet_paid';
  end if;
  update public.obligations set status = 'disputed', paid_at = null where id = v.id;
end;
$$;

create or replace function private.create_split_core(
  p_uid uuid, p_event_id uuid, p_description text, p_total_cents int,
  p_participants uuid[], p_shares jsonb, p_post_card boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
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
  if p_uid is null then
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
  if v_event.id is null or not (p_uid = any (coalesce(v_eligible, '{}')) or (p_shares is not null and private.is_going(p_event_id, p_uid))) then
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;
  if length(v_desc) not between 1 and 80 then
    raise exception 'Say what it was for (up to 80 characters)' using errcode = '22023';
  end if;
  if p_total_cents is null or p_total_cents not between 1 and 1000000 then
    raise exception 'The total must be between $0.01 and $10,000' using errcode = '22023';
  end if;

  if p_shares is not null then
    -- Custom amounts (itemised bills): anyone on the event's bills, and the amounts must add up
    select array_agg(k::uuid), sum((v)::bigint) into v_people, v_sum from jsonb_each_text(p_shares) as s(k, v);
    if v_people is null or not (v_people <@ (select array_agg(b.uid) from private.bill_people(p_event_id) b)) then
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
    if not (p_uid = any (v_people)) then
      v_people := array_append(v_people, p_uid);
    end if;
    v_n := cardinality(v_people);
    v_each := floor(p_total_cents::numeric / v_n);
    foreach v_person in array v_people loop
      v_shares := v_shares || jsonb_build_object(
        v_person::text,
        case when v_person = p_uid then p_total_cents - v_each * (v_n - 1) else v_each end
      );
    end loop;
  end if;

  perform private.hit_rate_limit('split:' || p_event_id, 20, interval '1 hour');

  insert into public.split_bills (event_id, payer_id, description, total_cents, payer_share_cents)
  values (p_event_id, p_uid, v_desc, p_total_cents, coalesce((v_shares->>p_uid::text)::int, 0))
  returning id into v_split;

  for v_person, v_cents in select k::uuid, v::int from jsonb_each_text(v_shares) as s(k, v) loop
    if v_person <> p_uid and v_cents > 0 then
      insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason, kind, split_id)
      values (p_event_id, v_person, p_uid, v_cents, 'shared_cost', 'split', v_split);
    end if;
  end loop;

  if p_post_card then
    v_message := private.post_message(p_event_id, p_uid, 'split', null, jsonb_build_object(
      'split_id', v_split, 'description', v_desc, 'total_cents', p_total_cents,
      'people', (select count(*) from jsonb_object_keys(v_shares))
    ));
    update public.split_bills set message_id = v_message where id = v_split;
  end if;
  return v_split;
end;
$$;
revoke execute on function private.create_split_core(uuid, uuid, text, int, uuid[], jsonb, boolean) from public, anon, authenticated;

-- Start a bill: the caller paid it. The photo is optional (lines can be typed in).
create or replace function public.create_receipt(p_event_id uuid, p_image_path text default null, p_description text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_desc text := coalesce(nullif(btrim(coalesce(p_description, '')), ''), 'The bill');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not private.is_going(p_event_id, v_uid) then
    raise exception 'Only people on this event can split a bill here' using errcode = '42501';
  end if;
  if length(v_desc) > 80 then
    raise exception 'Say what it was for (up to 80 characters)' using errcode = '22023';
  end if;
  if p_image_path is not null and p_image_path !~ ('^' || p_event_id::text || '/' || v_uid::text || '/[^/]+$') then
    raise exception 'That photo isn''t yours' using errcode = '42501';
  end if;
  perform private.hit_rate_limit('receipt:' || p_event_id, 20, interval '1 hour');
  insert into public.receipts (event_id, payer_id, description, image_path)
  values (p_event_id, v_uid, v_desc, p_image_path)
  returning id into v_id;
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- Notifications: "Gary paid you $39.60 from their wallet"
------------------------------------------------------------------------------
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
  'wallet_paid'
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
  elsif new.status = 'paid' and new.paid_via = 'wallet' then
    v_type := 'wallet_paid'; v_to := new.host_id; v_actor := new.guest_id; v_actor_name := v_guest;
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
    'kind', new.kind, 'description', v_what, 'paid_via', new.paid_via
  ));
  return new;
end;
$$;

------------------------------------------------------------------------------
-- Reads that now say how a debt was paid
------------------------------------------------------------------------------
drop function if exists public.get_my_obligations();
create function public.get_my_obligations()
returns table (
  id uuid, event_id uuid, event_title text, event_theme text, event_date timestamptz, role text,
  other_user_id uuid, other_name text, amount_cents int, currency text, reason text, status text,
  reference text, excuse text, excuse_declined boolean, created_at timestamptz, paid_at timestamptz,
  kind text, split_id uuid, description text, paid_via text
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.title, e.theme, e.date,
         case when o.guest_id = (select auth.uid()) then 'guest' else 'host' end,
         case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end,
         p.full_name, o.amount_cents, o.currency, o.reason, o.status,
         o.reference, o.excuse, o.excuse_declined, o.created_at, o.paid_at,
         o.kind, o.split_id, sb.description, o.paid_via
  from public.obligations o
  join public.events e on e.id = o.event_id
  left join public.split_bills sb on sb.id = o.split_id
  left join public.profiles p on p.id = case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end
  where o.guest_id = (select auth.uid()) or o.host_id = (select auth.uid())
  order by o.created_at desc;
$$;
revoke execute on function public.get_my_obligations() from public, anon;
grant execute on function public.get_my_obligations() to authenticated;

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

-- Each share in a split now says how it was paid, so a wallet payment shows as such
-- Each person's share and status, for the payer and the people in it only.
-- PayIDs never appear here; your own debt's id comes back so the app can open the pay page.
drop function if exists public.get_split(uuid);
create function public.get_split(p_split_id uuid)
returns table (user_id uuid, name text, share_cents int, status text, is_payer boolean, obligation_id uuid,
               description text, total_cents int, split_status text, paid_via text)
language sql stable security definer set search_path = '' as $$
  with s as (
    select sb.* from public.split_bills sb
    where sb.id = p_split_id
      and (sb.payer_id = (select auth.uid())
           or exists (select 1 from public.obligations o where o.split_id = sb.id and o.guest_id = (select auth.uid())))
  )
  select s.payer_id, p.full_name, s.payer_share_cents, 'payer', true, null::uuid, s.description, s.total_cents, s.status, null::text
  from s left join public.profiles p on p.id = s.payer_id
  union all
  select o.guest_id, p.full_name, o.amount_cents, o.status, false,
         case when o.guest_id = (select auth.uid()) then o.id end,
         s.description, s.total_cents, s.status, o.paid_via
  from s
  join public.obligations o on o.split_id = s.id
  left join public.profiles p on p.id = o.guest_id;
$$;
revoke execute on function public.get_split(uuid) from public, anon;
grant execute on function public.get_split(uuid) to authenticated;

------------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------------
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.get_my_wallet()',
    'public.add_wallet_method(text, text, text, int, int, text)',
    'public.remove_wallet_method(uuid)',
    'public.set_default_method(uuid)',
    'public.test_topup(int, uuid)',
    'public.pay_from_wallet(uuid, int)',
    'public.reset_test_wallet()',
    'public.get_my_dues(uuid)',
    'public.create_receipt(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
