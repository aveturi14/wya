-- Phase 8.18: dues. One answer to "what do I owe, what am I owed, and why?"
--
-- get_my_dues(p_event_id) lists every amount between the caller and someone
-- else, for one event (the Bills tab) or all of them (Your dues). Each entry
-- says who, how much, what it was for, where, its state, and for bills the
-- "why": the caller's items, how many shared each, and their part of the
-- extras. The app only draws it. Covers:
--   * debts (obligations): itemised bills once locked, even splits, pledges;
--   * bills still being claimed ("pending"): your current share as an
--     estimate, or (for the payer) each person's current share.
-- Nothing new is exposed: you only ever see debts you're part of and bills you
-- can already open, and never an address or a PayID. Safe to re-run.

-- A person's lines on a bill: what they ticked, how many shared it, their part
create or replace function private.receipt_person_items(p_receipt_id uuid, p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', i.name, 'quantity', i.quantity, 'amount_cents', i.amount_cents,
           'shared_by', n.n, 'my_cents', round(i.amount_cents::numeric / n.n)::int
         ) order by i.position), '[]'::jsonb)
  from public.receipt_items i
  cross join lateral (select count(*)::int as n from public.receipt_claims c where c.item_id = i.id) n
  where i.receipt_id = p_receipt_id and i.kind = 'item'
    and exists (select 1 from public.receipt_claims c where c.item_id = i.id and c.user_id = p_user_id);
$$;
revoke execute on function private.receipt_person_items(uuid, uuid) from public, anon, authenticated;

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
           o.paid_at, o.excuse_declined,
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
      'created_at', d.created_at, 'paid_at', d.paid_at,
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
revoke execute on function public.get_my_dues(uuid) from public, anon;
grant execute on function public.get_my_dues(uuid) to authenticated;

notify pgrst, 'reload schema';
