-- Phase 8.18: bills get their own tab on the event page (Details · Chat · Bills · Photos).
--
-- Sending a bill no longer posts a card in the event chat, so the chat stays
-- for talking. Everyone going is still told in Activity, and the Bills tab
-- lists every bill. send_receipt now returns nothing (it used to return the
-- card's id). There are no real users yet, so the few bill cards already
-- posted (testing) are removed; the app can still draw one if it meets one.
-- Safe to re-run.

delete from public.chat_messages where kind = 'receipt';  -- receipts.message_id is set null

drop function if exists public.send_receipt(uuid);

-- Send the bill to everyone going: the lines must add up first. Tells them in Activity; no chat card.
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
    raise exception 'Only people going can split a bill on this event' using errcode = '42501';
  end if;

  -- No chat card: bills live in the event's Bills tab, so the chat stays for talking
  update public.receipts set status = 'claiming', updated_at = now() where id = p_receipt_id;

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
end;
$$;

revoke execute on function public.send_receipt(uuid) from public, anon;
grant execute on function public.send_receipt(uuid) to authenticated;

notify pgrst, 'reload schema';
