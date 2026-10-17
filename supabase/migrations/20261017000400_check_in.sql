-- Phase 8.4: "I'm here" check-in (docs/PHASE8.md §4, 8.4).
--
-- A Going guest taps "I'm here" (or /here) during the event. It's a claim,
-- not proof (CHK-1): it shows up in the host's "Who came?" ("Checked in
-- 7:42 PM"), but the host still decides who came, and can still mark a
-- checked-in guest absent. A verified check-in (QR at the door) is a later item.
-- Safe to re-run.

alter table public.rsvps add column if not exists checked_in_at timestamptz;
-- Not in the guest's column grant (status, additional_details): only check_in writes it

-- From 2 hours before the start until the end, or 6 hours after the start
-- without an end time (CHK-2). Checking in again keeps the first time.
create or replace function public.check_in(p_event_id uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.events%rowtype;
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or not exists (
    select 1 from public.rsvps r where r.event_id = p_event_id and r.user_id = v_uid and r.status = 'yes'
  ) then
    raise exception 'Only people going can check in' using errcode = '42501';
  end if;
  if now() < v_event.date - interval '2 hours'
     or now() > coalesce(v_event.end_date, v_event.date + interval '6 hours') then
    raise exception 'You can check in from 2 hours before it starts until it ends.' using errcode = 'P0001', hint = 'check_in_closed';
  end if;
  update public.rsvps set checked_in_at = coalesce(checked_in_at, now())
  where event_id = p_event_id and user_id = v_uid
  returning checked_in_at into v_at;
  return v_at;
end;
$$;
revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;

-- The guest list gains checked_in_at, for the host only
drop function if exists public.get_guest_list(uuid);
create function public.get_guest_list(p_event_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, status text, additional_details text,
               pledge_cents int, attended boolean, reliability jsonb, checked_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.user_id, p.full_name, p.avatar_url, r.status,
         case when private.is_event_host(p_event_id) then r.additional_details end,
         case when private.is_event_host(p_event_id) then r.pledge_cents end,
         case when private.is_event_host(p_event_id) then r.attended end,
         case when private.is_event_host(p_event_id) then (select to_jsonb(rel) from public.get_reliability(r.user_id) rel) end,
         case when private.is_event_host(p_event_id) then r.checked_in_at end
  from public.rsvps r
  left join public.profiles p on p.id = r.user_id
  where r.event_id = p_event_id
    and (
      private.is_event_host(p_event_id)
      or (private.is_event_guest(p_event_id) and r.status in ('yes', 'maybe'))
    )
  order by p.full_name;
$$;
revoke execute on function public.get_guest_list(uuid) from public, anon;
grant execute on function public.get_guest_list(uuid) to authenticated;

notify pgrst, 'reload schema';
