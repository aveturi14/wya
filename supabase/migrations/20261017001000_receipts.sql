-- Phase 8.18: itemised receipt splits (docs/PHASE8.md §4, 8.18; brief: wya Split).
--
-- The person who paid photographs the bill, wya reads the lines (Edge Function
-- `scan-receipt`), and everyone going ticks what they had. Shared items split
-- between the people who tick them; surcharges, tips and discounts split in
-- proportion to what each person ordered. Once every line is claimed and every
-- claimer has confirmed their share, the payer locks it, which creates a normal
-- 8.3 split (custom shares) without a second chat card. Paying is unchanged:
-- split debts, the PayID pay page, "I've paid". wya still never touches money.
--
-- Status: draft (payer only) → claiming → locked; or cancelled. The payer can
-- unlock while nobody has paid; ticks are kept, and only people whose share
-- changed have to confirm again (a confirmation stores the share it agreed to).
-- Safe to re-run.

------------------------------------------------------------------------------
-- Who's going: the host, and Going guests not marked as no-shows (SPLIT-2)
------------------------------------------------------------------------------
create or replace function private.is_going(p_event_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid is not null and (
    exists (select 1 from public.events e where e.id = p_event_id and e.host_id = p_uid)
    or exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id and r.user_id = p_uid and r.status = 'yes' and r.attended is not false
    )
  );
$$;
revoke execute on function private.is_going(uuid, uuid) from public, anon;
grant execute on function private.is_going(uuid, uuid) to authenticated;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  payer_id uuid not null references auth.users on delete cascade,
  description text not null check (length(description) between 1 and 80),
  merchant text check (merchant is null or length(merchant) <= 80),
  image_path text,                    -- receipts/<event_id>/<payer_id>/<name>.jpg
  -- In draft: the printed total, which the lines must add up to. From claiming on: items + adjustments.
  total_cents int not null default 0 check (total_cents between 0 and 1000000),
  printed_subtotal_cents int check (printed_subtotal_cents is null or printed_subtotal_cents between 0 and 1000000),
  gst_included_cents int,             -- information only: Australian prices already include GST
  currency text not null default 'AUD',
  status text not null default 'draft' check (status in ('draft', 'claiming', 'locked', 'cancelled')),
  scan_source text check (scan_source in ('model', 'demo', 'manual')),
  split_id uuid references public.split_bills on delete set null,
  message_id uuid references public.chat_messages on delete set null,
  ready_notified_at timestamptz,      -- "everyone's confirmed" goes to the payer once per round
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipts_event_idx on public.receipts (event_id);
alter table public.receipts enable row level security;
revoke insert, update, delete on public.receipts from anon, authenticated;

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts on delete cascade,
  -- Copied from the receipt, so policies and live-update filters don't need a join
  event_id uuid not null references public.events on delete cascade,
  position int not null default 0,
  name text not null check (length(name) between 1 and 80),
  quantity int not null default 1 check (quantity between 1 and 999),
  -- The line total. Items are positive; adjustments (surcharge, tip, discount) can be negative.
  amount_cents int not null check (amount_cents between -1000000 and 1000000),
  kind text not null default 'item' check (kind in ('item', 'adjustment')),
  -- A percentage surcharge ("Sunday 10%") in basis points; recalculated when items change after sending
  rate_bp int check (rate_bp is null or rate_bp between -10000 and 10000),
  flagged boolean not null default false,  -- "check this line": the scan wasn't sure, or the maths didn't work
  check (kind = 'adjustment' or amount_cents > 0),
  check (kind = 'adjustment' or rate_bp is null)
);
create index if not exists receipt_items_receipt_idx on public.receipt_items (receipt_id, position);
create index if not exists receipt_items_event_idx on public.receipt_items (event_id);
alter table public.receipt_items enable row level security;
revoke insert, update, delete on public.receipt_items from anon, authenticated;

create table if not exists public.receipt_claims (
  item_id uuid not null references public.receipt_items on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  receipt_id uuid not null references public.receipts on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index if not exists receipt_claims_receipt_idx on public.receipt_claims (receipt_id);
create index if not exists receipt_claims_event_idx on public.receipt_claims (event_id);
alter table public.receipt_claims enable row level security;
revoke insert, update, delete on public.receipt_claims from anon, authenticated;

-- "This is my share: $39.60". Counts only while the share is still $39.60.
create table if not exists public.receipt_confirmations (
  receipt_id uuid not null references public.receipts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  share_cents int not null,
  confirmed_at timestamptz not null default now(),
  primary key (receipt_id, user_id)
);
create index if not exists receipt_confirmations_event_idx on public.receipt_confirmations (event_id);
alter table public.receipt_confirmations enable row level security;
revoke insert, update, delete on public.receipt_confirmations from anon, authenticated;

-- Drafts are the payer's alone; once sent, everyone going can see the bill
create or replace function private.can_see_receipt(p_receipt_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.receipts r
    where r.id = p_receipt_id
      and (r.payer_id = (select auth.uid())
           or (r.status <> 'draft' and private.is_going(r.event_id, (select auth.uid()))))
  );
$$;
revoke execute on function private.can_see_receipt(uuid) from public, anon;
grant execute on function private.can_see_receipt(uuid) to authenticated;

drop policy if exists "Payer and people going see receipts" on public.receipts;
create policy "Payer and people going see receipts" on public.receipts for select to authenticated
  using (private.can_see_receipt(id));
drop policy if exists "Payer and people going see receipt lines" on public.receipt_items;
create policy "Payer and people going see receipt lines" on public.receipt_items for select to authenticated
  using (private.can_see_receipt(receipt_id));
drop policy if exists "Payer and people going see claims" on public.receipt_claims;
create policy "Payer and people going see claims" on public.receipt_claims for select to authenticated
  using (private.can_see_receipt(receipt_id));
drop policy if exists "Payer and people going see confirmations" on public.receipt_confirmations;
create policy "Payer and people going see confirmations" on public.receipt_confirmations for select to authenticated
  using (private.can_see_receipt(receipt_id));

-- Live ticks while the claim screen is open
do $$
declare v_table text;
begin
  foreach v_table in array array['receipts', 'receipt_items', 'receipt_claims', 'receipt_confirmations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

------------------------------------------------------------------------------
-- Storage: a private bucket for receipt photos (the app re-encodes to JPEG)
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Paths are <event_id>/<user_id>/<name>.jpg; private.album_event parses the event safely (null, never an error)
drop policy if exists "Receipts: add to your own folder" on storage.objects;
drop policy if exists "Receipts: uploader and people going can read" on storage.objects;
drop policy if exists "Receipts: uploader can delete" on storage.objects;
create policy "Receipts: add to your own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and private.is_going(private.album_event(name), (select auth.uid()))
  );
create policy "Receipts: uploader and people going can read" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (split_part(name, '/', 2) = (select auth.uid())::text
         or private.is_going(private.album_event(name), (select auth.uid())))
  );
create policy "Receipts: uploader can delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and split_part(name, '/', 2) = (select auth.uid())::text);

------------------------------------------------------------------------------
-- Chat cards and Activity
------------------------------------------------------------------------------
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'image', 'poll', 'split', 'plan', 'bot', 'system', 'receipt'));

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
  'receipt_to_claim', 'receipt_ready', 'receipt_reopened'
));

-- Same as 8.0, plus the receipt preview
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
-- create_split, split into a core the receipt lock can reuse without posting
-- a second card. public.create_split behaves exactly as in 8.3.
------------------------------------------------------------------------------
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
  if v_event.id is null or not (p_uid = any (coalesce(v_eligible, '{}'))) then
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_methods m where m.user_id = p_uid and m.provider = 'payid') then
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

create or replace function public.create_split(
  p_event_id uuid, p_description text, p_total_cents int,
  p_participants uuid[] default null, p_shares jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  return private.create_split_core((select auth.uid()), p_event_id, p_description, p_total_cents,
                                   p_participants, p_shares, true);
end;
$$;

------------------------------------------------------------------------------
-- The maths (brief §3). Each item splits evenly between the people who ticked
-- it; adjustments follow each person's share of the items. Exact amounts are
-- floored to the cent for everyone but the payer, whose share is what's left,
-- so the shares always add up to the total. Until every item is claimed, the
-- payer's share is just their own ticks (rounded), for the screen.
------------------------------------------------------------------------------
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
  select count(*) into v_unclaimed from public.receipt_items i
  where i.receipt_id = p_receipt_id and i.kind = 'item'
    and not exists (select 1 from public.receipt_claims c where c.item_id = i.id);

  return query
  with per_item as (
    select i.id, i.amount_cents, (select count(*) from public.receipt_claims c where c.item_id = i.id) as n
    from public.receipt_items i
    where i.receipt_id = p_receipt_id and i.kind = 'item'
  ),
  food as (
    select c.user_id as uid, sum(pi.amount_cents::numeric / pi.n) as exact
    from public.receipt_claims c join per_item pi on pi.id = c.item_id
    where c.receipt_id = p_receipt_id
    group by c.user_id
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

-- Percentage surcharges follow the items; the total becomes items + adjustments
create or replace function private.recalc_receipt(p_receipt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_items bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_items from public.receipt_items where receipt_id = p_receipt_id and kind = 'item';
  update public.receipt_items set amount_cents = round(v_items * rate_bp / 10000.0)::int
  where receipt_id = p_receipt_id and kind = 'adjustment' and rate_bp is not null;
  update public.receipts
  set total_cents = (select coalesce(sum(amount_cents), 0) from public.receipt_items where receipt_id = p_receipt_id),
      updated_at = now()
  where id = p_receipt_id;
end;
$$;
revoke execute on function private.recalc_receipt(uuid) from public, anon, authenticated;

-- Why the payer can't lock yet, in plain words (empty when they can)
create or replace function private.receipt_blockers(p_receipt_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_unclaimed int;
  v_out text[] := '{}';
  v_name text;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.status <> 'claiming' then
    return array['This bill isn''t open for claiming'];
  end if;
  select count(*) into v_unclaimed from public.receipt_items i
  where i.receipt_id = p_receipt_id and i.kind = 'item'
    and not exists (select 1 from public.receipt_claims c where c.item_id = i.id);
  if v_unclaimed > 0 then
    v_out := array_append(v_out, case when v_unclaimed = 1 then '1 item nobody has ticked'
                                      else v_unclaimed || ' items nobody has ticked' end);
  end if;
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

-- The payer only, in the given states
create or replace function private.receipt_for_payer(p_receipt_id uuid, p_states text[])
returns public.receipts language plpgsql security definer set search_path = '' as $$
declare v_receipt public.receipts%rowtype;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if v_receipt.id is null or v_receipt.payer_id <> (select auth.uid()) then
    raise exception 'Only the person who paid can change this bill' using errcode = '42501';
  end if;
  if not (v_receipt.status = any (p_states)) then
    raise exception 'This bill can''t be changed right now' using errcode = 'P0001', hint = 'receipt_wrong_status';
  end if;
  return v_receipt;
end;
$$;
revoke execute on function private.receipt_for_payer(uuid, text[]) from public, anon, authenticated;

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
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
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_methods m where m.user_id = v_uid and m.provider = 'payid') then
    raise exception 'Add your PayID first (You → Get paid), so people can pay you back.' using errcode = 'P0001', hint = 'payid_required';
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

-- The Edge Function calls this before spending money on a scan
create or replace function public.begin_receipt_scan(p_receipt_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_receipt public.receipts%rowtype;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft']);
  if v_receipt.image_path is null then
    raise exception 'There''s no photo to read' using errcode = 'P0001', hint = 'receipt_no_photo';
  end if;
  perform private.hit_rate_limit('scan:' || (select auth.uid()), 10, interval '1 hour');
  return v_receipt.image_path;
end;
$$;

-- Replace every line of a draft (from the scan, the demo receipt, or typing).
-- p_items: [{name, quantity, amount_cents, kind, rate_bp?, flagged?}]
create or replace function public.save_receipt_draft(
  p_receipt_id uuid, p_items jsonb, p_total_cents int,
  p_printed_subtotal_cents int default null, p_merchant text default null,
  p_source text default 'manual', p_description text default null, p_gst_included_cents int default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_line jsonb;
  v_pos int := 0;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft']);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'A bill has up to 100 lines' using errcode = '22023';
  end if;
  if p_total_cents is null or p_total_cents not between 0 and 1000000 then
    raise exception 'The total must be between $0 and $10,000' using errcode = '22023';
  end if;
  if p_source not in ('model', 'demo', 'manual') then
    raise exception 'Unknown source' using errcode = '22023';
  end if;
  delete from public.receipt_items where receipt_id = p_receipt_id;
  for v_line in select * from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, event_id, position, name, quantity, amount_cents, kind, rate_bp, flagged)
    values (p_receipt_id, v_receipt.event_id, v_pos,
            left(btrim(coalesce(v_line->>'name', '')), 80),
            coalesce((v_line->>'quantity')::int, 1),
            (v_line->>'amount_cents')::int,
            coalesce(v_line->>'kind', 'item'),
            (v_line->>'rate_bp')::int,
            coalesce((v_line->>'flagged')::boolean, false));
    v_pos := v_pos + 1;
  end loop;
  update public.receipts
  set total_cents = p_total_cents, printed_subtotal_cents = p_printed_subtotal_cents,
      merchant = nullif(left(btrim(coalesce(p_merchant, '')), 80), ''), scan_source = p_source,
      -- A name the payer gave wins; the default becomes "Bill at <merchant>" once it's known
      description = coalesce(nullif(left(btrim(coalesce(p_description, '')), 80), ''),
                             case when description = 'The bill' and nullif(btrim(coalesce(p_merchant, '')), '') is not null
                                  then left('Bill at ' || btrim(p_merchant), 80) else description end),
      gst_included_cents = p_gst_included_cents, updated_at = now()
  where id = p_receipt_id;
end;
$$;

-- Add, change or remove one line. After sending, ticks on other lines are kept;
-- anyone whose share moves has to confirm again (their snapshot no longer matches).
create or replace function public.edit_receipt_item(
  p_receipt_id uuid, p_item_id uuid default null, p_name text default null, p_quantity int default 1,
  p_amount_cents int default null, p_kind text default 'item', p_rate_bp int default null, p_delete boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_id uuid := p_item_id;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft', 'claiming']);
  if p_item_id is not null and not exists (select 1 from public.receipt_items where id = p_item_id and receipt_id = p_receipt_id) then
    raise exception 'That line isn''t on this bill' using errcode = '22023';
  end if;
  if coalesce(p_delete, false) then
    delete from public.receipt_items where id = p_item_id;
  elsif p_item_id is null then
    insert into public.receipt_items (receipt_id, event_id, position, name, quantity, amount_cents, kind, rate_bp)
    values (p_receipt_id, v_receipt.event_id,
            (select coalesce(max(position), -1) + 1 from public.receipt_items where receipt_id = p_receipt_id),
            left(btrim(coalesce(p_name, '')), 80), coalesce(p_quantity, 1), p_amount_cents, coalesce(p_kind, 'item'), p_rate_bp)
    returning id into v_id;
  else
    update public.receipt_items
    set name = left(btrim(coalesce(p_name, name)), 80), quantity = coalesce(p_quantity, quantity),
        -- A line keeps its kind: ticks on an item can't turn into ticks on a surcharge
        amount_cents = coalesce(p_amount_cents, amount_cents),
        rate_bp = case when kind = 'adjustment' then p_rate_bp end, flagged = false
    where id = p_item_id;
  end if;
  if v_receipt.status = 'claiming' then
    perform private.recalc_receipt(p_receipt_id);
    update public.receipts set ready_notified_at = null where id = p_receipt_id;
    -- The card in the chat shows the bill was edited (and its new total)
    update public.chat_messages
    set data = data || jsonb_build_object('total_cents', (select total_cents from public.receipts where id = p_receipt_id),
                                          'edited_at', now())
    where id = v_receipt.message_id;
  end if;
  return v_id;
end;
$$;

-- Send the bill to everyone going: the lines must add up first
create or replace function public.send_receipt(p_receipt_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_items bigint;
  v_lines bigint;
  v_n int;
  v_message uuid;
  v_title text;
  v_payer text;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft']);
  select coalesce(sum(amount_cents) filter (where kind = 'item'), 0), coalesce(sum(amount_cents), 0),
         count(*) filter (where kind = 'item')
    into v_items, v_lines, v_n
  from public.receipt_items where receipt_id = p_receipt_id;
  if v_n = 0 then
    raise exception 'Add at least one item' using errcode = '22023', hint = 'receipt_empty';
  end if;
  if v_receipt.printed_subtotal_cents is not null and v_items <> v_receipt.printed_subtotal_cents then
    raise exception 'The items add up to $%, but the receipt says $%. Check the lines.',
      to_char(v_items / 100.0, 'FM999,990.00'), to_char(v_receipt.printed_subtotal_cents / 100.0, 'FM999,990.00')
      using errcode = '22023', hint = 'receipt_unbalanced';
  end if;
  if v_lines <> v_receipt.total_cents then
    raise exception 'The lines add up to $%, but the total is $%. Check the lines.',
      to_char(v_lines / 100.0, 'FM999,990.00'), to_char(v_receipt.total_cents / 100.0, 'FM999,990.00')
      using errcode = '22023', hint = 'receipt_unbalanced';
  end if;
  if v_receipt.total_cents not between 1 and 1000000 then
    raise exception 'The total must be between $0.01 and $10,000' using errcode = '22023';
  end if;
  -- The payer must still be going (they could have been marked a no-show since)
  if not private.is_going(v_receipt.event_id, v_receipt.payer_id) then
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;

  update public.receipts set status = 'claiming', updated_at = now() where id = p_receipt_id;
  v_message := private.post_message(v_receipt.event_id, v_receipt.payer_id, 'receipt', null, jsonb_build_object(
    'receipt_id', p_receipt_id, 'description', v_receipt.description, 'total_cents', v_receipt.total_cents,
    'merchant', v_receipt.merchant
  ));
  update public.receipts set message_id = v_message where id = p_receipt_id;

  select title into v_title from public.events where id = v_receipt.event_id;
  select full_name into v_payer from public.profiles where id = v_receipt.payer_id;
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select g.uid, 'receipt_to_claim', v_receipt.event_id, v_receipt.payer_id, jsonb_build_object(
    'title', v_title, 'actor_name', v_payer, 'description', v_receipt.description,
    'total_cents', v_receipt.total_cents, 'receipt_id', p_receipt_id)
  from (
    select e.host_id as uid from public.events e where e.id = v_receipt.event_id
    union
    select r.user_id from public.rsvps r
    where r.event_id = v_receipt.event_id and r.status = 'yes' and r.attended is not false
  ) g
  where g.uid <> v_receipt.payer_id;
  return v_message;
end;
$$;

-- Replace the caller's ticks (an empty list clears them)
create or replace function public.set_receipt_claims(p_receipt_id uuid, p_item_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_receipt public.receipts%rowtype;
  v_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- Shares the row with other claimers, but waits for a lock or edit in progress
  select * into v_receipt from public.receipts where id = p_receipt_id for share;
  if v_receipt.id is null or not private.is_going(v_receipt.event_id, v_uid) or v_receipt.status = 'draft' then
    raise exception 'Only people going can claim from this bill' using errcode = '42501';
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
  perform pg_advisory_xact_lock(hashtext('receipt:' || p_receipt_id || ':' || v_uid));
  delete from public.receipt_claims where receipt_id = p_receipt_id and user_id = v_uid and not (item_id = any (v_ids));
  insert into public.receipt_claims (item_id, user_id, receipt_id, event_id)
  select x, v_uid, p_receipt_id, v_receipt.event_id from unnest(v_ids) x
  on conflict do nothing;
end;
$$;

-- "This is my share". p_expected_cents is the amount on the person's screen.
create or replace function public.confirm_receipt_share(p_receipt_id uuid, p_expected_cents int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_receipt public.receipts%rowtype;
  v_share int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if v_receipt.id is null or not private.is_going(v_receipt.event_id, v_uid) or v_receipt.status = 'draft' then
    raise exception 'Only people going can claim from this bill' using errcode = '42501';
  end if;
  if v_receipt.status <> 'claiming' then
    raise exception 'This bill is locked' using errcode = 'P0001', hint = 'receipt_locked';
  end if;
  if not exists (select 1 from public.receipt_claims where receipt_id = p_receipt_id and user_id = v_uid) then
    raise exception 'Tick what you had first' using errcode = 'P0001', hint = 'receipt_nothing_claimed';
  end if;
  select s.share_cents into v_share from private.receipt_shares(p_receipt_id) s where s.user_id = v_uid;
  if v_share is distinct from p_expected_cents then
    raise exception 'Your share just changed. Check it and confirm again.' using errcode = 'P0001', hint = 'share_changed';
  end if;
  insert into public.receipt_confirmations (receipt_id, user_id, event_id, share_cents)
  values (p_receipt_id, v_uid, v_receipt.event_id, v_share)
  on conflict (receipt_id, user_id) do update set share_cents = excluded.share_cents, confirmed_at = now();

  -- Everyone's in: tell the payer once per round
  if v_receipt.ready_notified_at is null and cardinality(private.receipt_blockers(p_receipt_id)) = 0 then
    update public.receipts set ready_notified_at = now() where id = p_receipt_id;
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    values (v_receipt.payer_id, 'receipt_ready', v_receipt.event_id, v_uid, jsonb_build_object(
      'title', (select title from public.events where id = v_receipt.event_id),
      'description', v_receipt.description, 'total_cents', v_receipt.total_cents, 'receipt_id', p_receipt_id));
  end if;
end;
$$;

-- Everything a claim screen needs, in one call. Null if you can't see it.
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
    select e.host_id as uid from public.events e where e.id = v_receipt.event_id
    union
    select r.user_id from public.rsvps r
    where r.event_id = v_receipt.event_id and r.status = 'yes' and r.attended is not false
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
    'claimed_cents', (select coalesce(sum(i.amount_cents), 0) from public.receipt_items i
                      where i.receipt_id = p_receipt_id and i.kind = 'item'
                        and exists (select 1 from public.receipt_claims c where c.item_id = i.id)),
    'split_id', v_receipt.split_id,
    'updated_at', v_receipt.updated_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'position', i.position, 'name', i.name, 'quantity', i.quantity,
        'amount_cents', i.amount_cents, 'kind', i.kind, 'rate_bp', i.rate_bp, 'flagged', i.flagged,
        'claimers', coalesce((select jsonb_agg(c.user_id order by c.created_at) from public.receipt_claims c where c.item_id = i.id), '[]'::jsonb)
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

-- Turn the confirmed shares into split debts (paid by PayID, like 8.3)
create or replace function public.lock_receipt(p_receipt_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_blockers text[];
  v_shares jsonb;
  v_split uuid;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['claiming']);
  v_blockers := private.receipt_blockers(p_receipt_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Not ready to lock: %', array_to_string(v_blockers, ', ')
      using errcode = 'P0001', hint = 'receipt_not_ready';
  end if;
  select jsonb_object_agg(s.user_id::text, s.share_cents) into v_shares
  from private.receipt_shares(p_receipt_id) s where s.share_cents > 0 or s.user_id = v_receipt.payer_id;

  v_split := private.create_split_core(v_receipt.payer_id, v_receipt.event_id, v_receipt.description,
                                       v_receipt.total_cents, null, v_shares, false);
  update public.split_bills set message_id = v_receipt.message_id where id = v_split;
  update public.receipts set status = 'locked', split_id = v_split, updated_at = now() where id = p_receipt_id;
  update public.chat_messages set data = data || jsonb_build_object('locked', true, 'split_id', v_split)
  where id = v_receipt.message_id;
  return v_split;
end;
$$;

-- Back to claiming, while nobody has paid (or claimed to). Ticks are kept.
create or replace function public.unlock_receipt(p_receipt_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_receipt public.receipts%rowtype;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['locked']);
  if exists (select 1 from public.obligations where split_id = v_receipt.split_id and status <> 'owed') then
    raise exception 'Someone has already paid, so this bill can''t be reopened' using errcode = 'P0001', hint = 'receipt_paid';
  end if;
  -- The "You owe" items would point at debts that no longer exist
  delete from public.notifications n
  using public.obligations o
  where o.split_id = v_receipt.split_id and n.type = 'split_owed' and n.data->>'obligation_id' = o.id::text;
  -- The split's split_bills.message_id is the receipt card: detach it so the card survives
  update public.split_bills set message_id = null where id = v_receipt.split_id;
  delete from public.split_bills where id = v_receipt.split_id;  -- its debts go with it
  update public.receipts set status = 'claiming', split_id = null, ready_notified_at = null, updated_at = now()
  where id = p_receipt_id;
  update public.chat_messages set data = (data - 'split_id') || '{"locked": false}'::jsonb where id = v_receipt.message_id;

  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select distinct c.user_id, 'receipt_reopened', v_receipt.event_id, v_receipt.payer_id, jsonb_build_object(
    'title', (select title from public.events where id = v_receipt.event_id),
    'actor_name', (select full_name from public.profiles where id = v_receipt.payer_id),
    'description', v_receipt.description, 'receipt_id', p_receipt_id)
  from public.receipt_claims c
  where c.receipt_id = p_receipt_id and c.user_id <> v_receipt.payer_id;
end;
$$;

-- Call the whole thing off. Anything still owed is waived (8.3 cancel_split).
create or replace function public.cancel_receipt(p_receipt_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_receipt public.receipts%rowtype;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft', 'claiming', 'locked']);
  if v_receipt.split_id is not null then
    perform public.cancel_split(v_receipt.split_id);
  end if;
  update public.receipts set status = 'cancelled', updated_at = now() where id = p_receipt_id;
  update public.chat_messages set data = data || '{"cancelled": true}'::jsonb where id = v_receipt.message_id;
end;
$$;

-- Bills waiting on me, for Home → Needs you
create or replace function public.get_my_open_receipts()
returns table (receipt_id uuid, event_id uuid, event_title text, description text, payer_name text,
               total_cents int, share_cents int, claimed boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.event_id, e.title, r.description, p.full_name, r.total_cents, s.share_cents, s.user_id is not null
  from public.receipts r
  join public.events e on e.id = r.event_id
  left join public.profiles p on p.id = r.payer_id
  left join lateral (
    select x.user_id, x.share_cents from private.receipt_shares(r.id) x
    where x.user_id = (select auth.uid())
      and exists (select 1 from public.receipt_claims c where c.receipt_id = r.id and c.user_id = x.user_id)
  ) s on true
  where r.status = 'claiming'
    and r.payer_id <> (select auth.uid())
    and private.is_going(r.event_id, (select auth.uid()))
    and not exists (select 1 from public.receipt_confirmations c
                    where c.receipt_id = r.id and c.user_id = (select auth.uid()) and c.share_cents = s.share_cents)
  order by r.created_at desc;
$$;

------------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------------
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.create_receipt(uuid, text, text)',
    'public.begin_receipt_scan(uuid)',
    'public.save_receipt_draft(uuid, jsonb, int, int, text, text, text, int)',
    'public.edit_receipt_item(uuid, uuid, text, int, int, text, int, boolean)',
    'public.send_receipt(uuid)',
    'public.set_receipt_claims(uuid, uuid[])',
    'public.confirm_receipt_share(uuid, int)',
    'public.get_receipt(uuid)',
    'public.lock_receipt(uuid)',
    'public.unlock_receipt(uuid)',
    'public.cancel_receipt(uuid)',
    'public.get_my_open_receipts()'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
