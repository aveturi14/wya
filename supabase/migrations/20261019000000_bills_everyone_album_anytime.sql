-- Bills for everyone on the event, and albums open from the start of planning.
--
-- * Anyone on an event can start a bill and claim from one: the host and every
--   guest (invited, maybe, going or can't go), except someone still asking to
--   join or marked as a no-show. Before, only people going could. The bill
--   functions all ask private.is_going, so it now means "on this event's bills";
--   private.bill_people lists them.
-- * Photos can be added from when the event is made until 30 days after it
--   (before: only from the start). Still the host and Going guests. The Photos
--   tab still lists only albums with photos or events that have started.
-- Safe to re-run.

create or replace function private.is_going(p_event_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- "On this event's bills": the host, or any guest who isn't waiting to be let in or marked absent
  select p_uid is not null and (
    exists (select 1 from public.events e where e.id = p_event_id and e.host_id = p_uid)
    or exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id and r.user_id = p_uid and r.status <> 'requested' and r.attended is not false
    )
  );
$$;

create or replace function private.bill_people(p_event_id uuid)
returns table (uid uuid) language sql stable security definer set search_path = '' as $$
  select e.host_id from public.events e where e.id = p_event_id
  union
  select r.user_id from public.rsvps r
  where r.event_id = p_event_id and r.status <> 'requested' and r.attended is not false;
$$;
revoke execute on function private.bill_people(uuid) from public, anon, authenticated;

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

-- Same as before; the refusal now says who can claim
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
    raise exception 'Only people on this event can claim from this bill' using errcode = '42501';
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

drop function if exists public.send_receipt(uuid);

-- Send the bill to everyone on the event: the lines must add up first. Tells them in Activity; no chat card.
create or replace function public.send_receipt(p_receipt_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.receipts%rowtype;
  v_items bigint;
  v_lines bigint;
  v_n int;
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
    raise exception 'Only people on this event can split a bill here' using errcode = '42501';
  end if;

  -- No chat card: bills live in the event's Bills tab, so the chat stays for talking
  update public.receipts set status = 'claiming', updated_at = now() where id = p_receipt_id;

  select title into v_title from public.events where id = v_receipt.event_id;
  select full_name into v_payer from public.profiles where id = v_receipt.payer_id;
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select g.uid, 'receipt_to_claim', v_receipt.event_id, v_receipt.payer_id, jsonb_build_object(
    'title', v_title, 'actor_name', v_payer, 'description', v_receipt.description,
    'total_cents', v_receipt.total_cents, 'receipt_id', p_receipt_id)
  from private.bill_people(v_receipt.event_id) g
  where g.uid <> v_receipt.payer_id;
end;
$$;

revoke execute on function public.send_receipt(uuid) from public, anon;
grant execute on function public.send_receipt(uuid) to authenticated;

------------------------------------------------------------------------------
-- Albums
------------------------------------------------------------------------------
-- Host, or Going and not marked as a no-show; from when the event is made until 30 days after it
create or replace function private.can_add_photos(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and now() < e.date + interval '30 days'
      and (
        e.host_id = (select auth.uid())
        or exists (
          select 1 from public.rsvps r
          where r.event_id = e.id and r.user_id = (select auth.uid())
            and r.status = 'yes' and r.attended is not false
        )
      )
  );
$$;

create or replace function public.get_album(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_limits record;
begin
  select * into v_limits from private.album_limits();
  if not private.can_view_photos(p_event_id) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event_id;
  return jsonb_build_object(
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'user_id', p.user_id, 'path', p.path, 'thumb_path', p.thumb_path,
        'width', p.width, 'height', p.height, 'created_at', p.created_at,
        'uploader_name', pr.full_name, 'uploader_avatar', pr.avatar_url
      ) order by p.created_at desc)
      from public.photos p left join public.profiles pr on pr.id = p.user_id
      where p.event_id = p_event_id
    ), '[]'::jsonb),
    'can_add', private.can_add_photos(p_event_id),
    'is_host', v_event.host_id = (select auth.uid()),
    'my_count', (select count(*) from public.photos where event_id = p_event_id and user_id = (select auth.uid())),
    'per_person', v_limits.per_person,
    'per_event', v_limits.per_event,
    'opens_at', v_event.created_at,
    'closes_at', v_event.date + interval '30 days'
  );
end;
$$;

drop function if exists public.get_my_albums();
create function public.get_my_albums()
returns table (
  event_id uuid,
  title text,
  theme text,
  cover_image text,
  starts_at timestamptz,
  photo_count int,
  thumb_paths text[],
  is_open boolean
)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    -- Narrow to the caller's own events first, then apply the album rule itself
    select e.id from public.events e where e.host_id = (select auth.uid())
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

revoke execute on function public.get_my_albums() from public, anon;
grant execute on function public.get_my_albums() to authenticated;

notify pgrst, 'reload schema';
