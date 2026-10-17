-- Phase 8.5: a host's track record (docs/PHASE8.md §4, 8.5).
--
-- Guests already have a record ("came to 9 of 10"). This is the other side:
-- "Hannah's events: 8 happened, 0 called off late", so guests can trust that a
-- plan is really on. Cancelled events are deleted (and their debts forgiven),
-- so a trigger remembers late cancellations before the row goes (REC-2:
-- deleted within 48 hours of the start, or after it, with someone Going).
-- Safe to re-run.

create table if not exists private.host_cancellations (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users on delete cascade,
  event_date timestamptz not null,
  cancelled_at timestamptz not null default now(),
  going_count int not null
);
create index if not exists host_cancellations_host_idx on private.host_cancellations (host_id);
alter table private.host_cancellations enable row level security;
revoke all on private.host_cancellations from public, anon, authenticated;

create or replace function private.remember_late_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_going int;
begin
  if now() >= old.date - interval '48 hours' then
    select count(*) into v_going from public.rsvps r where r.event_id = old.id and r.status = 'yes';
    if v_going > 0 then
      insert into private.host_cancellations (host_id, event_date, going_count) values (old.host_id, old.date, v_going);
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists on_event_delete_remember on public.events;
-- BEFORE DELETE, so the RSVPs are still there to count (they cascade away with the event)
create trigger on_event_delete_remember before delete on public.events
  for each row execute procedure private.remember_late_cancel();
revoke execute on function private.remember_late_cancel() from public, anon, authenticated;

-- For yourself, or a host you share an event with (REC-1); nobody else, never logged out
create or replace function public.get_host_record(p_host_id uuid)
returns table (hosted int, happened int, cancelled_late int)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_host_id <> v_uid and not private.shares_event_with(p_host_id) then
    return;
  end if;
  return query
    select
      (select count(*)::int from public.events e where e.host_id = p_host_id and e.date < now()),
      -- Happened: past events with someone Going, or with Who came? filled in
      (select count(*)::int from public.events e
       where e.host_id = p_host_id and e.date < now()
         and exists (select 1 from public.rsvps r where r.event_id = e.id
                     and (r.status = 'yes' or r.attendance_marked_at is not null))),
      (select count(*)::int from private.host_cancellations c where c.host_id = p_host_id);
end;
$$;
revoke execute on function public.get_host_record(uuid) from public, anon;
grant execute on function public.get_host_record(uuid) to authenticated;

notify pgrst, 'reload schema';
