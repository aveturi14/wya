-- Phase 8.9: flexible plans (docs/PHASE8.md §4, 8.9).
--
-- "Dinner, then maybe the 9:30 movie, then drinks." A short itinerary inside
-- the event, not a calendar: at most 8 items. Items run back to back from the
-- event's start; an item with a fixed start (a booking, a session time) keeps
-- it, and is flagged as a conflict when the item before it runs over. Anyone
-- who can chat adds items and says something's running late; the item's
-- creator or the host removes it (PLAN-1). The plan shows in the chat as a card.
-- Safe to re-run.

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  position int not null,
  title text not null check (length(title) between 1 and 60),
  duration_minutes int not null check (duration_minutes between 5 and 720),
  fixed_start timestamptz,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists plan_items_event_idx on public.plan_items (event_id, position);
alter table public.plan_items enable row level security;
revoke insert, update, delete on public.plan_items from anon, authenticated;
drop policy if exists "Event people see the plan" on public.plan_items;
create policy "Event people see the plan" on public.plan_items for select to authenticated
  using (private.is_event_host(event_id) or private.is_event_guest(event_id));

-- Live updates while the chat is open
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_items'
  ) then
    alter publication supabase_realtime add table public.plan_items;
  end if;
end $$;

create or replace function public.add_plan_item(p_event_id uuid, p_title text, p_duration_minutes int, p_fixed_start timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not private.can_chat(p_event_id) then
    raise exception 'Only people going (or maybe) can add to the plan' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'Give it a name (up to 60 characters)' using errcode = '22023';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 5 and 720 then
    raise exception 'Between 5 minutes and 12 hours' using errcode = '22023';
  end if;
  -- One change at a time per event, so two people adding at once can't pass the limit
  perform pg_advisory_xact_lock(hashtext('plan:' || p_event_id));
  if (select count(*) from public.plan_items where event_id = p_event_id) >= 8 then
    raise exception 'A plan can have up to 8 things' using errcode = '22023';
  end if;
  insert into public.plan_items (event_id, position, title, duration_minutes, fixed_start, created_by)
  values (p_event_id,
          coalesce((select max(position) from public.plan_items where event_id = p_event_id), 0) + 1,
          btrim(p_title), p_duration_minutes, p_fixed_start, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- "Dinner's running 45 minutes over" (negative: finished early)
create or replace function public.delay_plan_item(p_item_id uuid, p_minutes int)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_item public.plan_items%rowtype;
begin
  select * into v_item from public.plan_items where id = p_item_id;
  if v_item.id is null or not private.can_chat(v_item.event_id) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes = 0 or v_item.duration_minutes + p_minutes not between 5 and 720 then
    raise exception 'That would make it shorter than 5 minutes or longer than 12 hours' using errcode = '22023';
  end if;
  update public.plan_items set duration_minutes = duration_minutes + p_minutes where id = p_item_id;
end;
$$;

create or replace function public.remove_plan_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_item public.plan_items%rowtype;
begin
  select * into v_item from public.plan_items where id = p_item_id;
  if v_item.id is null or not (v_item.created_by = (select auth.uid()) or private.is_event_host(v_item.event_id)) then
    raise exception 'Only whoever added it, or the host, can remove it' using errcode = '42501';
  end if;
  delete from public.plan_items where id = p_item_id;
end;
$$;

-- The plan, re-flowed on every call. The order column is `item_order`: `position`
-- isn't allowed as an output name here (it's an SQL keyword).
drop function if exists public.get_plan(uuid);
create function public.get_plan(p_event_id uuid)
returns table (id uuid, item_order int, title text, duration_minutes int, fixed_start timestamptz,
               starts_at timestamptz, ends_at timestamptz, conflict boolean, created_by uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cursor timestamptz;
  v_item record;
  v_first boolean := true;
begin
  if not (private.is_event_host(p_event_id) or private.is_event_guest(p_event_id)) then
    return;
  end if;
  select e.date into v_cursor from public.events e where e.id = p_event_id;
  for v_item in
    select p.id, p.position, p.title, p.duration_minutes, p.fixed_start, p.created_by
    from public.plan_items p where p.event_id = p_event_id order by p.position
  loop
    id := v_item.id; item_order := v_item.position; title := v_item.title;
    duration_minutes := v_item.duration_minutes; fixed_start := v_item.fixed_start; created_by := v_item.created_by;
    if v_item.fixed_start is not null then
      -- A booking keeps its time; it clashes if the previous thing runs past it
      conflict := not v_first and v_cursor > v_item.fixed_start;
      starts_at := v_item.fixed_start;
    else
      conflict := false;
      starts_at := v_cursor;
    end if;
    ends_at := starts_at + make_interval(mins => v_item.duration_minutes);
    v_cursor := ends_at;
    v_first := false;
    return next;
  end loop;
end;
$$;

-- /plan: show the plan in the chat as a card (it reads get_plan live)
create or replace function public.post_plan(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.can_chat(p_event_id) then
    raise exception 'Only people going (or maybe) can post the plan' using errcode = '42501';
  end if;
  perform private.hit_rate_limit('plan_card:' || p_event_id, 10, interval '1 hour');
  return private.post_message(p_event_id, (select auth.uid()), 'plan', null, '{}'::jsonb);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'add_plan_item(uuid, text, int, timestamptz)', 'delay_plan_item(uuid, int)', 'remove_plan_item(uuid)',
    'get_plan(uuid)', 'post_plan(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
