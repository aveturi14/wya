-- Wallet test mode is OFF unless someone turns it on (issue #38).
--
-- 20261019000100_wallet.sql created private.wallet_config with test_mode default true, so a database
-- built from the migrations alone let any signed-in user add fake "test" money and pay real debts
-- with it. The beta never touches money through wya (docs/PHASE8.md, Direction update), so a fresh
-- database must end with test mode OFF.
--
-- wya-dev turns it on again explicitly: supabase/seed.sql does it, or run once:
--   update private.wallet_config set test_mode = true where id;
--
-- Safe to re-run.

alter table private.wallet_config alter column test_mode set default false;
update private.wallet_config set test_mode = false where id;

-- pay_from_wallet used to work from any existing balance even with test mode off. Same body as the
-- collections migration, plus one guard: no wallet payments unless test mode is on.
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
  if not coalesce((select test_mode from private.wallet_config where id), false) then
    raise exception 'Paying from the wallet isn''t available yet' using errcode = 'P0001', hint = 'wallet_off';
  end if;
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
