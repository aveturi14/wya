-- Claiming part of a line: "3 wines: Gary had 2, Jo had 1" (8.18).
--
-- On a line with a quantity above 1, each claim is either
--   * a number of units ("I had 2"): that many at the unit price, or
--   * shared (units null, the default when you tick): everyone sharing splits
--     whatever units nobody claimed as their own.
-- So "Karaage ×2 shared by three" still splits three ways, and "3 wines, Gary
-- had 2, Jo and Sam shared the third" works too. Nobody can claim more units
-- than are left. A line is fully claimed when its units are all taken, or when
-- somebody is sharing the rest. Quantity-1 lines work as before (split evenly).
-- Existing claims are all "shared", so every bill adds up exactly as it did.
-- Safe to re-run.

alter table public.receipt_claims add column if not exists units int;
alter table public.receipt_claims drop constraint if exists receipt_claims_units_check;
alter table public.receipt_claims add constraint receipt_claims_units_check check (units is null or units between 1 and 999);

-- One row per line: how much is claimed, and each claimer's exact part of it
create or replace function private.receipt_claim_parts(p_receipt_id uuid)
returns table (item_id uuid, user_id uuid, units int, exact numeric)
language sql stable security definer set search_path = '' as $$
  with lines as (
    select i.id, i.amount_cents::numeric as amount, i.quantity,
           coalesce(sum(c.units), 0) as units_sum,
           count(c.user_id) filter (where c.units is null) as shared_n
    from public.receipt_items i
    left join public.receipt_claims c on c.item_id = i.id
    where i.receipt_id = p_receipt_id and i.kind = 'item'
    group by i.id
  )
  select c.item_id, c.user_id, c.units,
         case
           when l.quantity > 1 and c.units is not null then l.amount * c.units / l.quantity
           -- Sharing: the units nobody took for themselves, split evenly
           else (l.amount - l.amount * least(l.units_sum, l.quantity) / l.quantity) / nullif(l.shared_n, 0)
         end
  from public.receipt_claims c join lines l on l.id = c.item_id
  where c.receipt_id = p_receipt_id;
$$;
revoke execute on function private.receipt_claim_parts(uuid) from public, anon, authenticated;

-- Each line: claimed in full or not, and how much of it is claimed (for the bar)
create or replace function private.receipt_line_status(p_receipt_id uuid)
returns table (item_id uuid, name text, quantity int, units_left int, complete boolean, claimed_cents numeric)
language sql stable security definer set search_path = '' as $$
  select i.id, i.name, i.quantity,
         greatest(i.quantity - coalesce(sum(c.units), 0), 0)::int,
         count(c.user_id) > 0 and (count(*) filter (where c.units is null and c.user_id is not null) > 0 or coalesce(sum(c.units), 0) >= i.quantity),
         case when count(c.user_id) = 0 then 0
              when count(*) filter (where c.units is null and c.user_id is not null) > 0 or coalesce(sum(c.units), 0) >= i.quantity then i.amount_cents
              else i.amount_cents::numeric * coalesce(sum(c.units), 0) / i.quantity end
  from public.receipt_items i
  left join public.receipt_claims c on c.item_id = i.id
  where i.receipt_id = p_receipt_id and i.kind = 'item'
  group by i.id;
$$;
revoke execute on function private.receipt_line_status(uuid) from public, anon, authenticated;

-- The maths, as before, but from each claimer's part of each line
create or replace function private.receipt_shares(p_receipt_id uuid)
returns table (user_id uuid, food_cents int, adjust_cents int, share_cents int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_items bigint;
  v_adjust bigint;
  v_unclaimed int;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.id is null then
    return;
  end if;
  select coalesce(sum(i.amount_cents) filter (where i.kind = 'item'), 0),
         coalesce(sum(i.amount_cents) filter (where i.kind = 'adjustment'), 0)
    into v_items, v_adjust
  from public.receipt_items i where i.receipt_id = p_receipt_id;
  select count(*) into v_unclaimed from private.receipt_line_status(p_receipt_id) l where not l.complete;

  return query
  with food as (
    select p.user_id as uid, sum(coalesce(p.exact, 0)) as exact
    from private.receipt_claim_parts(p_receipt_id) p
    group by p.user_id
  ),
  people as (
    select f.uid, f.exact from food f
    union all
    select v_receipt.payer_id, 0::numeric where not exists (select 1 from food f where f.uid = v_receipt.payer_id)
  ),
  owed as (
    select p.uid, p.exact,
           greatest(0, floor(p.exact + case when v_items > 0 then v_adjust * p.exact / v_items else 0 end))::int as floored
    from people p
  ),
  shares as (
    select o.uid, o.exact,
           case
             when o.uid <> v_receipt.payer_id then o.floored
             when v_unclaimed = 0 then (v_receipt.total_cents - coalesce((select sum(x.floored) from owed x where x.uid <> v_receipt.payer_id), 0))::int
             else round(o.exact + case when v_items > 0 then v_adjust * o.exact / v_items else 0 end)::int
           end as share
    from owed o
  )
  select s.uid, round(s.exact)::int, s.share - round(s.exact)::int, s.share from shares s;
end;
$$;
revoke execute on function private.receipt_shares(uuid) from public, anon, authenticated;

-- "2 of 3 Wine still unclaimed"
create or replace function private.receipt_blockers(p_receipt_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_out text[] := '{}';
  v_line record;
  v_name text;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.status <> 'claiming' then
    return array['This bill isn''t open for claiming'];
  end if;
  for v_line in select * from private.receipt_line_status(p_receipt_id) l where not l.complete order by l.name loop
    v_out := array_append(v_out, case
      when v_line.quantity > 1 and v_line.units_left < v_line.quantity
        then v_line.units_left || ' of ' || v_line.quantity || ' ' || v_line.name || ' still unclaimed'
      else v_line.name || ': nobody has ticked it' end);
  end loop;
  for v_name in
    select coalesce(p.full_name, 'Someone') from private.receipt_shares(p_receipt_id) s
    left join public.profiles p on p.id = s.user_id
    where s.user_id <> v_receipt.payer_id and s.share_cents > 0
      and not exists (select 1 from public.receipt_confirmations c
                      where c.receipt_id = p_receipt_id and c.user_id = s.user_id and c.share_cents = s.share_cents)
    order by 1
  loop
    v_out := array_append(v_out, v_name || ' hasn''t confirmed');
  end loop;
  if v_receipt.total_cents < 1 then
    v_out := array_append(v_out, 'The total has to be more than $0');
  end if;
  return v_out;
end;
$$;
revoke execute on function private.receipt_blockers(uuid) from public, anon, authenticated;

-- Your ticks, and how many units you had of each line with a quantity.
-- p_units: {"<item id>": 2} for "I had 2"; lines you tick without a number are shared.
drop function if exists public.set_receipt_claims(uuid, uuid[]);
create or replace function public.set_receipt_claims(p_receipt_id uuid, p_item_ids uuid[], p_units jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_receipt public.receipts%rowtype;
  v_ids uuid[];
  v_item public.receipt_items%rowtype;
  v_units int;
  v_others int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_receipt from public.receipts where id = p_receipt_id for share;
  if v_receipt.id is null or not private.is_going(v_receipt.event_id, v_uid) or v_receipt.status = 'draft' then
    raise exception 'Only people on this event can claim from this bill' using errcode = '42501';
  end if;
  if v_receipt.status <> 'claiming' then
    raise exception 'This bill is locked' using errcode = 'P0001', hint = 'receipt_locked';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_item_ids, '{}')) x;
  if exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from public.receipt_items i where i.id = x and i.receipt_id = p_receipt_id and i.kind = 'item')
  ) then
    raise exception 'That isn''t an item on this bill' using errcode = '22023';
  end if;
  -- Two people taking the last wine at once: the line's row decides who got there first
  perform 1 from public.receipt_items where id = any (v_ids) order by id for update;

  for v_item in select * from public.receipt_items where id = any (v_ids) loop
    v_units := nullif(p_units ->> v_item.id::text, '')::int;
    if v_units is null or v_item.quantity <= 1 then continue; end if;
    if v_units < 1 or v_units > v_item.quantity then
      raise exception 'Pick between 1 and % % ', v_item.quantity, v_item.name using errcode = '22023', hint = 'units_out_of_range';
    end if;
    select coalesce(sum(units), 0) into v_others from public.receipt_claims
    where item_id = v_item.id and user_id <> v_uid and units is not null;
    if v_others + v_units > v_item.quantity then
      raise exception 'Only % of the % % left to claim', greatest(v_item.quantity - v_others, 0), v_item.quantity, v_item.name
        using errcode = 'P0001', hint = 'too_many_units';
    end if;
  end loop;

  delete from public.receipt_claims where receipt_id = p_receipt_id and user_id = v_uid and not (item_id = any (v_ids));
  insert into public.receipt_claims (item_id, user_id, receipt_id, event_id, units)
  select x, v_uid, p_receipt_id, v_receipt.event_id,
         case when i.quantity > 1 then nullif(p_units ->> x::text, '')::int end
  from unnest(v_ids) x join public.receipt_items i on i.id = x
  on conflict (item_id, user_id) do update set units = excluded.units;
end;
$$;
revoke execute on function public.set_receipt_claims(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.set_receipt_claims(uuid, uuid[], jsonb) to authenticated;

-- Dues: your lines with your units and your exact part
create or replace function private.receipt_person_items(p_receipt_id uuid, p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', i.name, 'quantity', i.quantity, 'amount_cents', i.amount_cents,
           'units', p.units,
           'shared_by', case when p.units is null then (select count(*) from public.receipt_claims c where c.item_id = i.id and c.units is null) else 1 end,
           'my_cents', round(p.exact)::int
         ) order by i.position), '[]'::jsonb)
  from private.receipt_claim_parts(p_receipt_id) p
  join public.receipt_items i on i.id = p.item_id
  where p.user_id = p_user_id;
$$;
revoke execute on function private.receipt_person_items(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_receipt public.receipts%rowtype;
  v_out jsonb;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.id is null or not private.can_see_receipt(p_receipt_id) then
    return null;
  end if;

  with shares as (select * from private.receipt_shares(p_receipt_id)),
  going as (
    select b.uid from private.bill_people(v_receipt.event_id) b
    union
    select v_receipt.payer_id
  )
  select jsonb_build_object(
    'id', v_receipt.id,
    'event_id', v_receipt.event_id,
    'event_title', (select title from public.events where id = v_receipt.event_id),
    'payer_id', v_receipt.payer_id,
    'payer_name', (select full_name from public.profiles where id = v_receipt.payer_id),
    'is_payer', v_receipt.payer_id = v_uid,
    'description', v_receipt.description,
    'merchant', v_receipt.merchant,
    'status', v_receipt.status,
    'scan_source', v_receipt.scan_source,
    'image_path', v_receipt.image_path,
    'total_cents', v_receipt.total_cents,
    'printed_subtotal_cents', v_receipt.printed_subtotal_cents,
    'gst_included_cents', v_receipt.gst_included_cents,
    'items_cents', (select coalesce(sum(amount_cents), 0) from public.receipt_items where receipt_id = p_receipt_id and kind = 'item'),
    'claimed_cents', (select coalesce(round(sum(l.claimed_cents)), 0)::int from private.receipt_line_status(p_receipt_id) l),
    'split_id', v_receipt.split_id,
    'updated_at', v_receipt.updated_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'position', i.position, 'name', i.name, 'quantity', i.quantity,
        'amount_cents', i.amount_cents, 'kind', i.kind, 'rate_bp', i.rate_bp, 'flagged', i.flagged,
        'claimers', coalesce((select jsonb_agg(c.user_id order by c.created_at) from public.receipt_claims c where c.item_id = i.id), '[]'::jsonb),
        -- Per person: units they had (null = sharing the rest)
        'claims', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'units', c.units) order by c.created_at)
                            from public.receipt_claims c where c.item_id = i.id), '[]'::jsonb),
        'units_claimed', (select coalesce(sum(c.units), 0) from public.receipt_claims c where c.item_id = i.id)
      ) order by i.position)
      from public.receipt_items i where i.receipt_id = p_receipt_id
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', g.uid, 'name', p.full_name, 'avatar_url', p.avatar_url,
        'is_payer', g.uid = v_receipt.payer_id,
        'food_cents', coalesce(s.food_cents, 0), 'adjust_cents', coalesce(s.adjust_cents, 0),
        'share_cents', coalesce(s.share_cents, 0),
        'claimed', exists (select 1 from public.receipt_claims c where c.receipt_id = p_receipt_id and c.user_id = g.uid),
        'confirmed', exists (select 1 from public.receipt_confirmations c
                             where c.receipt_id = p_receipt_id and c.user_id = g.uid and c.share_cents = s.share_cents)
      ) order by g.uid = v_receipt.payer_id desc, p.full_name)
      from going g
      left join public.profiles p on p.id = g.uid
      left join shares s on s.user_id = g.uid
    ), '[]'::jsonb),
    'blockers', case when v_receipt.status = 'claiming' then to_jsonb(private.receipt_blockers(p_receipt_id)) else '[]'::jsonb end,
    'split', case when v_receipt.split_id is null then null else (
      select jsonb_agg(to_jsonb(s)) from public.get_split(v_receipt.split_id) s
    ) end
  ) into v_out;
  return v_out;
end;
$$;

notify pgrst, 'reload schema';
