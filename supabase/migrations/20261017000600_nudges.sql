-- Phase 8.6: nudges in Activity (docs/PHASE8.md §4, 8.6).
--
-- Fewer "are you coming?" texts from the host:
--   * rsvp_reminder: once, to anyone still 'invited' — within 24 hours of the
--     cutoff on a pledge event, within 24 hours of the start otherwise (NUD-1);
--   * excuse_prompt: once, 24 hours after a late cancellation with no excuse
--     yet (NUD-2), so a real reason gets heard instead of a silent debt;
--   * remind_unanswered (/remind): the host nudges everyone still invited or
--     Maybe right now, at most once every 12 hours per event.
-- These are Activity items today; push (8.13) delivers the same rows to phones.
-- Safe to re-run.

alter table public.rsvps add column if not exists nudged_at timestamptz;
alter table public.obligations add column if not exists excuse_prompted_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added',
  'join_requested', 'join_approved',
  'split_owed',
  'rsvp_reminder', 'excuse_prompt'
));

-- Only acts on what's due, so calling it early (the tests do) changes nothing extra
create or replace function public.process_nudges()
returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; v_n int;
begin
  with due as (
    update public.rsvps r set nudged_at = now()
    from public.events e
    where e.id = r.event_id and r.status = 'invited' and r.nudged_at is null
      and (
        (e.deposit_mode = 'pledge' and now() >= private.cutoff_at(e) - interval '24 hours' and now() < private.cutoff_at(e))
        or (e.deposit_mode <> 'pledge' and now() >= e.date - interval '24 hours' and now() < e.date)
      )
    returning r.user_id, e.id as event_id, e.title, e.host_id
  )
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select d.user_id, 'rsvp_reminder', d.event_id, d.host_id,
         jsonb_build_object('title', d.title, 'actor_name', (select full_name from public.profiles where id = d.host_id))
  from due d;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  with due as (
    update public.obligations o set excuse_prompted_at = now()
    where o.kind = 'pledge' and o.reason = 'late_cancel' and o.status = 'owed' and o.excuse is null
      and o.excuse_prompted_at is null and o.created_at <= now() - interval '24 hours'
    returning o.guest_id, o.event_id, o.host_id, o.id, o.amount_cents
  )
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select d.guest_id, 'excuse_prompt', d.event_id, d.host_id, jsonb_build_object(
    'title', (select title from public.events where id = d.event_id),
    'actor_name', (select full_name from public.profiles where id = d.host_id),
    'amount_cents', d.amount_cents, 'obligation_id', d.id)
  from due d;
  get diagnostics v_n = row_count;
  return v_count + v_n;
end;
$$;
revoke execute on function public.process_nudges() from public, anon;
grant execute on function public.process_nudges() to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wya-nudges';
  perform cron.schedule('wya-nudges', '*/15 * * * *', 'select public.process_nudges()');
end $$;

-- The host's /remind: everyone still invited or Maybe, now (not limited to once)
create or replace function public.remind_unanswered(p_event_id uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_n int;
begin
  select * into v_event from public.events where id = p_event_id;
  if (select auth.uid()) is null or v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can send reminders' using errcode = '42501';
  end if;
  perform private.hit_rate_limit('remind:' || p_event_id, 1, interval '12 hours');
  update public.rsvps set nudged_at = now() where event_id = p_event_id and status in ('invited', 'maybe');
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select r.user_id, 'rsvp_reminder', p_event_id, v_event.host_id,
         jsonb_build_object('title', v_event.title, 'actor_name', (select full_name from public.profiles where id = v_event.host_id))
  from public.rsvps r
  where r.event_id = p_event_id and r.status in ('invited', 'maybe');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.remind_unanswered(uuid) from public, anon;
grant execute on function public.remind_unanswered(uuid) to authenticated;

notify pgrst, 'reload schema';
