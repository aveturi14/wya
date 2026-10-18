-- Wallet: cash out (9.13, test balance).
--
-- Take money back out of your wallet, to one of your saved cards or Apple Pay.
-- Test mode only, like top-ups: the money leaves the ledger to "outside"
-- (user_id null), nothing real is paid out. With a payments partner (9.10/9.12)
-- this becomes a payout request. Also: every debt (pledges too) is paid from
-- the wallet in the app now; claim_paid stays for older clients only.
-- Safe to re-run.

alter table public.wallet_txns drop constraint if exists wallet_txns_kind_check;
alter table public.wallet_txns add constraint wallet_txns_kind_check check (kind in ('topup', 'payment', 'test_reset', 'cashout'));

create or replace function public.test_cashout(p_cents int, p_method_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_balance int;
  v_txn uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if not coalesce((select test_mode from private.wallet_config where id), false) then
    raise exception 'Cashing out isn''t available yet' using errcode = 'P0001', hint = 'cashout_unavailable';
  end if;
  if not exists (select 1 from public.wallet_methods where id = p_method_id and user_id = v_uid) then
    raise exception 'Choose one of your saved cards to send it to' using errcode = '42501', hint = 'method_not_yours';
  end if;
  perform private.ensure_wallet(v_uid);
  select balance_cents into v_balance from public.wallets where user_id = v_uid for update;
  if p_cents is null or p_cents < 100 then
    raise exception 'Cash out at least $1' using errcode = '22023', hint = 'cashout_amount';
  end if;
  if p_cents > v_balance then
    raise exception 'You have $% in your wallet', to_char(v_balance / 100.0, 'FM999990.00') using errcode = 'P0001', hint = 'insufficient_funds';
  end if;
  perform private.hit_rate_limit('cashout:' || v_uid, 20, interval '1 hour');
  insert into public.wallet_txns (kind, amount_cents, created_by, method_id, description)
  values ('cashout', p_cents, v_uid, p_method_id, 'Cash out (test)') returning id into v_txn;
  insert into public.wallet_entries (txn_id, user_id, amount_cents) values (v_txn, v_uid, -p_cents), (v_txn, null, p_cents);
  update public.wallets set balance_cents = balance_cents - p_cents, updated_at = now() where user_id = v_uid
  returning balance_cents into v_balance;
  return jsonb_build_object('balance_cents', v_balance, 'txn_id', v_txn);
end;
$$;
revoke execute on function public.test_cashout(int, uuid) from public, anon;
grant execute on function public.test_cashout(int, uuid) to authenticated;

-- The wallet page's movements now name cash-outs too
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
              when t.kind = 'cashout' then 'Cashed out'
              when e.amount_cents < 0 then 'Paid ' || coalesce(split_part(pt.full_name, ' ', 1), 'someone')
              else coalesce(split_part(pf.full_name, ' ', 1), 'Someone') || ' paid you' end,
          'subtitle', case when t.kind = 'topup' then coalesce(private.method_label(m), 'Test top-up')
                           when t.kind = 'cashout' then 'To ' || coalesce(private.method_label(m), 'your bank')
                           else t.description end,
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
revoke execute on function public.get_my_wallet() from public, anon;
grant execute on function public.get_my_wallet() to authenticated;

-- Pledges are paid into the host's wya wallet now, so turning them on no longer needs a PayID
create or replace function private.check_pledge_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  return new;
end;
$$;

notify pgrst, 'reload schema';
