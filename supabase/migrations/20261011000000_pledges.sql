-- Phase 3: pledges. Going on a pledge event means "if I don't show, I'll pay
-- the host"; flakes pay the host directly by PayID, and wya never touches the
-- money. Full design and decisions: docs/PLAN.md → Phase 3. Safe to re-run.

------------------------------------------------------------------------------
-- Payment methods: one row per user per provider. Read your own directly;
-- write only through set_payid / remove_payid (they validate). Guests see a
-- host's PayID only through get_payment_instructions, while they owe them.
------------------------------------------------------------------------------
create table if not exists public.payment_methods (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  provider text not null check (provider in ('payid')),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.payment_methods enable row level security;
drop policy if exists "Users see their own payment methods" on public.payment_methods;
create policy "Users see their own payment methods" on public.payment_methods for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.payment_methods from anon, authenticated;

------------------------------------------------------------------------------
-- Event settings and per-guest pledge state
------------------------------------------------------------------------------
alter table public.events add column if not exists deposit_mode text not null default 'none';
alter table public.events add column if not exists deposit_cents int not null default 500;
-- Hours before the start; stored relative so the cutoff moves with the event (R1)
alter table public.events add column if not exists cutoff_hours int not null default 24;
alter table public.events drop constraint if exists events_deposit_mode_check;
-- Option A will add 'upfront'
alter table public.events add constraint events_deposit_mode_check check (deposit_mode in ('none', 'pledge'));
alter table public.events drop constraint if exists events_deposit_cents_check;
alter table public.events add constraint events_deposit_cents_check check (deposit_cents between 100 and 5000);
alter table public.events drop constraint if exists events_cutoff_hours_check;
alter table public.events add constraint events_cutoff_hours_check check (cutoff_hours between 0 and 336);

-- A pledge belongs to the RSVP, not the event: the amount the guest agreed to
-- (R2), kept even if the host later turns pledges off without releasing (R4b)
alter table public.rsvps add column if not exists pledge_cents int;
alter table public.rsvps add column if not exists attended boolean;
alter table public.rsvps add column if not exists attendance_marked_at timestamptz;
alter table public.rsvps add column if not exists maybe_reminded_at timestamptz;
alter table public.rsvps drop constraint if exists rsvps_pledge_cents_check;
alter table public.rsvps add constraint rsvps_pledge_cents_check check (pledge_cents is null or pledge_cents > 0);

------------------------------------------------------------------------------
-- Obligations: what a guest owes a host. Readable by the two of them;
-- changed only by the functions and triggers below.
------------------------------------------------------------------------------
create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  -- Deleting an event forgives its debts (R12)
  event_id uuid not null references public.events on delete cascade,
  guest_id uuid not null references auth.users on delete cascade,
  host_id uuid not null references auth.users on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'AUD',
  -- Option A adds 'upfront'; split costs adds 'shared_cost'
  reason text not null check (reason in ('no_show', 'late_cancel')),
  -- Open: owed, excuse_pending, disputed. Settled: paid, waived.
  -- Option A adds due / refund_due / refunded.
  status text not null default 'owed' check (status in ('owed', 'excuse_pending', 'paid', 'waived', 'disputed')),
  -- What the guest types in their bank transfer description
  reference text not null unique default ('WYA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  excuse text,
  excuse_declined boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  resolved_at timestamptz,
  unique (event_id, guest_id)
);
create index if not exists obligations_guest_idx on public.obligations (guest_id, status);
create index if not exists obligations_host_idx on public.obligations (host_id, status);
alter table public.obligations enable row level security;
drop policy if exists "Guest and host see their obligations" on public.obligations;
create policy "Guest and host see their obligations" on public.obligations for select to authenticated
  using (guest_id = (select auth.uid()) or host_id = (select auth.uid()));
revoke insert, update, delete on public.obligations from anon, authenticated;

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
create or replace function private.cutoff_at(p_event public.events)
returns timestamptz language sql immutable set search_path = '' as $$
  select p_event.date - make_interval(hours => p_event.cutoff_hours);
$$;

create or replace function private.has_open_debt(p_guest uuid, p_host uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.obligations
    where guest_id = p_guest and host_id = p_host and status in ('owed', 'excuse_pending', 'disputed')
  );
$$;

-- Mobile (04… / +614…), email, or an ABN that passes its checksum. Returns the
-- normalised value, or null if invalid. lib/payments/payid.ts mirrors this.
create or replace function private.normalize_payid(p_value text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_value, ''));
  v_digits text := regexp_replace(v, '[\s\-\(\)]', '', 'g');
  v_weights int[] := array[10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  v_sum int := 0;
begin
  if v_digits ~ '^04\d{8}$' then return '+61' || substr(v_digits, 2); end if;
  if v_digits ~ '^\+614\d{8}$' then return v_digits; end if;
  if v_digits ~ '^614\d{8}$' then return '+' || v_digits; end if;
  if v ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return lower(v); end if;
  if v_digits ~ '^\d{11}$' then
    for i in 1..11 loop
      v_sum := v_sum + v_weights[i] * (substr(v_digits, i, 1)::int - case when i = 1 then 1 else 0 end);
    end loop;
    if v_sum % 89 = 0 then return v_digits; end if;
  end if;
  return null;
end;
$$;

------------------------------------------------------------------------------
-- PayID
------------------------------------------------------------------------------
create or replace function public.set_payid(p_value text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_norm text := private.normalize_payid(p_value);
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if v_norm is null then
    raise exception 'That doesn''t look like a PayID. Use your mobile number, email or ABN.' using errcode = '22023';
  end if;
  insert into public.payment_methods (user_id, provider, value)
  values ((select auth.uid()), 'payid', v_norm)
  on conflict (user_id, provider) do update set value = excluded.value, updated_at = now();
  return v_norm;
end;
$$;

-- You can change your PayID but not remove it while people owe you (R9)
create or replace function public.remove_payid()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.obligations
    where host_id = (select auth.uid()) and status in ('owed', 'excuse_pending', 'disputed')
  ) then
    raise exception 'People still owe you money, so your PayID can''t be removed yet. You can change it instead.' using errcode = '42501';
  end if;
  delete from public.payment_methods where user_id = (select auth.uid()) and provider = 'payid';
end;
$$;

------------------------------------------------------------------------------
-- Events: pledges need a PayID; turning them on asks going guests to confirm
------------------------------------------------------------------------------
create or replace function private.check_pledge_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deposit_mode = 'pledge' and not exists (
    select 1 from public.payment_methods where user_id = new.host_id and provider = 'payid'
  ) then
    raise exception 'Add your PayID (You → Get paid) before turning on pledges.' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists on_event_check_pledge on public.events;
create trigger on_event_check_pledge before insert or update of deposit_mode on public.events
  for each row execute procedure private.check_pledge_event();

-- R3: guests already going aren't pledged until they confirm
create or replace function private.notify_pledge_added()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.deposit_mode is distinct from 'pledge' and new.deposit_mode = 'pledge' then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select r.user_id, 'pledge_added', new.id, new.host_id,
           jsonb_build_object('title', new.title, 'amount_cents', new.deposit_cents,
                              'actor_name', (select full_name from public.profiles where id = new.host_id))
    from public.rsvps r
    where r.event_id = new.id and r.status = 'yes' and r.pledge_cents is null;
  end if;
  return new;
end;
$$;
drop trigger if exists on_event_pledge_added on public.events;
create trigger on_event_pledge_added after update of deposit_mode on public.events
  for each row execute procedure private.notify_pledge_added();

-- R4(a): turning pledges off and releasing everyone (R4(b) is just turning it off)
create or replace function public.release_pledges(p_event_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype; v_count int;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can release pledges' using errcode = '42501';
  end if;
  with released as (
    update public.rsvps set pledge_cents = null
    where event_id = p_event_id and pledge_cents is not null
    returning user_id
  ), notified as (
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select user_id, 'pledge_released', v_event.id, v_event.host_id,
           jsonb_build_object('title', v_event.title, 'actor_name', (select full_name from public.profiles where id = v_event.host_id))
    from released
    returning 1
  )
  select count(*) into v_count from notified;
  return v_count;
end;
$$;

------------------------------------------------------------------------------
-- RSVPs: block while owing (R6), no Maybe after the cutoff (R11), save the
-- pledge on I'm in (R2/R3), late cancellations become debts (D5)
------------------------------------------------------------------------------
create or replace function private.rsvp_pledge_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = new.event_id;

  if new.status in ('yes', 'maybe') and new.status is distinct from old.status
     and private.has_open_debt(new.user_id, v_event.host_id) then
    raise exception 'You still owe this host from a previous event. Settle up to RSVP.' using errcode = 'P0001', hint = 'OPEN_DEBT';
  end if;

  if new.status = 'maybe' and old.status is distinct from 'maybe'
     and v_event.deposit_mode = 'pledge' and now() >= private.cutoff_at(v_event) then
    raise exception 'It''s past the cutoff, so it''s I''m in or Can''t go now.' using errcode = 'P0001', hint = 'PAST_CUTOFF';
  end if;

  if new.status = 'yes' and v_event.deposit_mode = 'pledge' and new.pledge_cents is null then
    new.pledge_cents := v_event.deposit_cents;
  elsif new.status <> 'yes' and old.status = 'yes' and now() < private.cutoff_at(v_event) then
    -- Cancelling before the cutoff is free
    new.pledge_cents := null;
  end if;
  return new;
end;
$$;
drop trigger if exists on_rsvp_pledge_rules on public.rsvps;
create trigger on_rsvp_pledge_rules before update of status on public.rsvps
  for each row execute procedure private.rsvp_pledge_rules();

create or replace function private.rsvp_late_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  if old.status = 'yes' and new.status = 'no' and new.pledge_cents is not null then
    select * into v_event from public.events where id = new.event_id;
    if now() >= private.cutoff_at(v_event) then
      insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason)
      values (new.event_id, new.user_id, v_event.host_id, new.pledge_cents, 'late_cancel')
      on conflict (event_id, guest_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_rsvp_late_cancel on public.rsvps;
create trigger on_rsvp_late_cancel after update of status on public.rsvps
  for each row execute procedure private.rsvp_late_cancel();

------------------------------------------------------------------------------
-- Attendance: the host unticks no-shows, from the start until 7 days after
-- (R5). Unmarked = assumed came.
------------------------------------------------------------------------------
create or replace function public.record_attendance(p_event_id uuid, p_absent uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or v_event.host_id <> (select auth.uid()) then
    raise exception 'Only the host can mark attendance' using errcode = '42501';
  end if;
  if now() < v_event.date then
    raise exception 'You can mark who came once the event has started.' using errcode = 'P0001';
  end if;
  if now() > v_event.date + interval '7 days' then
    raise exception 'Attendance can only be marked within 7 days of the event.' using errcode = 'P0001';
  end if;

  update public.rsvps
  set attended = not (user_id = any (coalesce(p_absent, '{}'))), attendance_marked_at = now()
  where event_id = p_event_id and status = 'yes';

  -- New no-shows with a pledge owe it
  insert into public.obligations (event_id, guest_id, host_id, amount_cents, reason)
  select p_event_id, r.user_id, v_event.host_id, r.pledge_cents, 'no_show'
  from public.rsvps r
  where r.event_id = p_event_id and r.status = 'yes' and r.attended = false and r.pledge_cents is not null
  on conflict (event_id, guest_id) do nothing;

  -- Re-ticked guests: drop the no-show debt unless it's already been paid
  delete from public.obligations o
  using public.rsvps r
  where o.event_id = p_event_id and o.reason = 'no_show' and o.status <> 'paid'
    and r.event_id = o.event_id and r.user_id = o.guest_id and r.attended = true;
end;
$$;

------------------------------------------------------------------------------
-- Settling up
------------------------------------------------------------------------------
create or replace function private.obligation_for(p_id uuid, p_role text)
returns public.obligations language plpgsql stable security definer set search_path = '' as $$
declare v public.obligations%rowtype;
begin
  select * into v from public.obligations where id = p_id;
  if v.id is null
     or (p_role = 'guest' and v.guest_id <> (select auth.uid()))
     or (p_role = 'host' and v.host_id <> (select auth.uid())) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- "I've paid" is trusted straight away (D3)
create or replace function public.claim_paid(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'guest');
begin
  if v.status = 'paid' then return; end if;  -- a double tap, or two devices: already done
  if v.status not in ('owed', 'disputed') then raise exception 'Nothing to pay here' using errcode = 'P0001'; end if;
  update public.obligations set status = 'paid', paid_at = now() where id = v.id and status in ('owed', 'disputed');
end;
$$;

create or replace function public.dispute_payment(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.status <> 'paid' then raise exception 'Only a payment marked as paid can be disputed' using errcode = 'P0001'; end if;
  update public.obligations set status = 'disputed', paid_at = null where id = v.id;
end;
$$;

-- One excuse per debt (R7)
create or replace function public.submit_excuse(p_obligation_id uuid, p_excuse text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'guest');
begin
  if v.excuse is not null then raise exception 'You''ve already sent an excuse for this' using errcode = 'P0001'; end if;
  if v.status not in ('owed', 'disputed') then raise exception 'There''s nothing to excuse here' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_excuse, ''))) not between 1 and 500 then
    raise exception 'Write a short reason (up to 500 characters)' using errcode = '22023';
  end if;
  update public.obligations set status = 'excuse_pending', excuse = btrim(p_excuse) where id = v.id;
end;
$$;

create or replace function public.resolve_excuse(p_obligation_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.status <> 'excuse_pending' then raise exception 'No excuse waiting here' using errcode = 'P0001'; end if;
  if p_accept then
    update public.obligations set status = 'waived', resolved_at = now() where id = v.id;
  else
    update public.obligations set status = 'owed', excuse_declined = true where id = v.id;
  end if;
end;
$$;

create or replace function public.waive_obligation(p_obligation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'host');
begin
  if v.status not in ('owed', 'excuse_pending', 'disputed') then raise exception 'This is already settled' using errcode = 'P0001'; end if;
  update public.obligations set status = 'waived', resolved_at = now() where id = v.id;
end;
$$;

create or replace function public.waive_all(p_event_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not exists (select 1 from public.events where id = p_event_id and host_id = (select auth.uid())) then
    raise exception 'Only the host can waive debts' using errcode = '42501';
  end if;
  update public.obligations set status = 'waived', resolved_at = now()
  where event_id = p_event_id and status in ('owed', 'excuse_pending', 'disputed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The "You owe" card: only for the guest, only while it's open
create or replace function public.get_payment_instructions(p_obligation_id uuid)
returns table (host_name text, provider text, payid text, amount_cents int, currency text, reference text, event_title text)
language plpgsql stable security definer set search_path = '' as $$
declare v public.obligations%rowtype := private.obligation_for(p_obligation_id, 'guest');
begin
  if v.status not in ('owed', 'disputed') then return; end if;
  return query
    select p.full_name, m.provider, m.value, v.amount_cents, v.currency, v.reference, e.title
    from public.events e
    left join public.profiles p on p.id = v.host_id
    left join public.payment_methods m on m.user_id = v.host_id and m.provider = 'payid'
    where e.id = v.event_id;
end;
$$;

-- Every debt you're part of, as guest (you owe) or host (owed to you)
create or replace function public.get_my_obligations()
returns table (
  id uuid, event_id uuid, event_title text, event_theme text, event_date timestamptz, role text,
  other_user_id uuid, other_name text, amount_cents int, currency text, reason text, status text,
  reference text, excuse text, excuse_declined boolean, created_at timestamptz, paid_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.title, e.theme, e.date,
         case when o.guest_id = (select auth.uid()) then 'guest' else 'host' end,
         case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end,
         p.full_name, o.amount_cents, o.currency, o.reason, o.status,
         o.reference, o.excuse, o.excuse_declined, o.created_at, o.paid_at
  from public.obligations o
  join public.events e on e.id = o.event_id
  left join public.profiles p on p.id = case when o.guest_id = (select auth.uid()) then o.host_id else o.guest_id end
  where o.guest_id = (select auth.uid()) or o.host_id = (select auth.uid())
  order by o.created_at desc;
$$;

------------------------------------------------------------------------------
-- Reliability (D4/R10): yourself, or hosts of an event you're invited to
------------------------------------------------------------------------------
create or replace function public.get_reliability(p_user_id uuid)
returns table (attended int, counted int, open_debts int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id <> (select auth.uid()) and not exists (
    select 1 from public.rsvps r join public.events e on e.id = r.event_id
    where r.user_id = p_user_id and e.host_id = (select auth.uid())
  ) then
    return;
  end if;
  -- Table aliases avoid clashing with the output column names
  return query
    select
      (select count(*)::int from public.rsvps r where r.user_id = p_user_id and r.attended = true),
      (select count(*)::int from public.rsvps r where r.user_id = p_user_id and r.attended is not null)
        + (select count(*)::int from public.obligations o where o.guest_id = p_user_id and o.reason = 'late_cancel'),
      (select count(*)::int from public.obligations o where o.guest_id = p_user_id and o.status in ('owed', 'excuse_pending', 'disputed'));
end;
$$;

-- The guest list now also says who's pledged, who came and each guest's
-- track record (host only). The record comes in the same call so a big guest
-- list is one request, not one per guest.
drop function if exists public.get_guest_list(uuid);
create function public.get_guest_list(p_event_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, status text, additional_details text,
               pledge_cents int, attended boolean, reliability jsonb)
language sql stable security definer set search_path = '' as $$
  select r.user_id, p.full_name, p.avatar_url, r.status,
         case when private.is_event_host(p_event_id) then r.additional_details end,
         case when private.is_event_host(p_event_id) then r.pledge_cents end,
         case when private.is_event_host(p_event_id) then r.attended end,
         case when private.is_event_host(p_event_id) then (select to_jsonb(rel) from public.get_reliability(r.user_id) rel) end
  from public.rsvps r
  left join public.profiles p on p.id = r.user_id
  where r.event_id = p_event_id
    and (
      private.is_event_host(p_event_id)
      or (private.is_event_guest(p_event_id) and r.status in ('yes', 'maybe'))
    )
  order by p.full_name;
$$;

------------------------------------------------------------------------------
-- Notifications for every step of a debt
------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired'
));

create or replace function private.notify_obligation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text := (select title from public.events where id = new.event_id);
  v_guest text := (select full_name from public.profiles where id = new.guest_id);
  v_host text := (select full_name from public.profiles where id = new.host_id);
  v_type text; v_to uuid; v_actor uuid; v_actor_name text;
begin
  if tg_op = 'INSERT' then
    v_type := 'pledge_owed'; v_to := new.guest_id; v_actor := new.host_id; v_actor_name := v_host;
  elsif new.status = old.status then
    return new;
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
    'reason', new.reason, 'accepted', new.status = 'waived', 'obligation_id', new.id
  ));
  return new;
end;
$$;
drop trigger if exists on_obligation_notify on public.obligations;
create trigger on_obligation_notify after insert or update of status on public.obligations
  for each row execute procedure private.notify_obligation_change();

------------------------------------------------------------------------------
-- Maybes (D7): a reminder within 24 hours of the cutoff, then Can't go at the
-- cutoff. Runs every 15 minutes; also callable directly (it only acts on
-- things that are already due, so calling it early does nothing extra).
------------------------------------------------------------------------------
create or replace function public.process_pledge_deadlines()
returns void language plpgsql security definer set search_path = '' as $$
begin
  with due as (
    update public.rsvps r set maybe_reminded_at = now()
    from public.events e
    where e.id = r.event_id and e.deposit_mode = 'pledge' and r.status = 'maybe' and r.maybe_reminded_at is null
      and now() >= private.cutoff_at(e) - interval '24 hours' and now() < private.cutoff_at(e)
    returning r.user_id, e.id as event_id, e.title, e.host_id, private.cutoff_at(e) as cutoff
  )
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select user_id, 'maybe_reminder', event_id, host_id, jsonb_build_object('title', title, 'cutoff', cutoff)
  from due;

  with expired as (
    update public.rsvps r set status = 'no'
    from public.events e
    where e.id = r.event_id and e.deposit_mode = 'pledge' and r.status = 'maybe'
      and now() >= private.cutoff_at(e)
    returning r.user_id, e.id as event_id, e.title, e.host_id
  )
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select user_id, 'maybe_expired', event_id, host_id, jsonb_build_object('title', title)
  from expired;
end;
$$;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wya-pledge-deadlines';
  perform cron.schedule('wya-pledge-deadlines', '*/15 * * * *', 'select public.process_pledge_deadlines()');
end $$;

------------------------------------------------------------------------------
-- Who may call what
------------------------------------------------------------------------------
revoke execute on function private.cutoff_at(public.events) from public, anon;
revoke execute on function private.has_open_debt(uuid, uuid) from public, anon;
revoke execute on function private.normalize_payid(text) from public, anon;
revoke execute on function private.obligation_for(uuid, text) from public, anon;
grant execute on function private.cutoff_at(public.events) to authenticated;
grant execute on function private.has_open_debt(uuid, uuid) to authenticated;
grant execute on function private.normalize_payid(text) to authenticated;
grant execute on function private.obligation_for(uuid, text) to authenticated;

revoke execute on function private.check_pledge_event() from public, anon, authenticated;
revoke execute on function private.notify_pledge_added() from public, anon, authenticated;
revoke execute on function private.rsvp_pledge_rules() from public, anon, authenticated;
revoke execute on function private.rsvp_late_cancel() from public, anon, authenticated;
revoke execute on function private.notify_obligation_change() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'set_payid(text)', 'remove_payid()', 'release_pledges(uuid)', 'record_attendance(uuid, uuid[])',
    'claim_paid(uuid)', 'dispute_payment(uuid)', 'submit_excuse(uuid, text)', 'resolve_excuse(uuid, boolean)',
    'waive_obligation(uuid)', 'waive_all(uuid)', 'get_payment_instructions(uuid)', 'get_my_obligations()',
    'get_reliability(uuid)', 'get_guest_list(uuid)', 'process_pledge_deadlines()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
