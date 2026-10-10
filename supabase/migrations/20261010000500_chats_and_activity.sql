-- R.9 part 3: the Chats tab (unread counts) and the Activity feed. Safe to re-run.

------------------------------------------------------------------------------
-- Chats: when each person last read each event chat
------------------------------------------------------------------------------
create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.chat_reads enable row level security;

drop policy if exists "Users manage their own chat reads" on public.chat_reads;
create policy "Users manage their own chat reads" on public.chat_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.mark_chat_read(p_event_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.chat_reads (user_id, event_id, last_read_at)
  values ((select auth.uid()), p_event_id, now())
  on conflict (user_id, event_id) do update set last_read_at = excluded.last_read_at;
$$;

-- Every chat you can take part in (you host it, or you're Going / Maybe),
-- with its latest message and how many messages from others you haven't read
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
         lm.content, lm.user_id, lp.full_name, lm.created_at,
         (
           select count(*)::int from public.chat_messages c
           where c.event_id = m.id
             and c.user_id <> (select auth.uid())
             and c.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)
         )
  from mine m
  left join lateral (
    select c.content, c.user_id, c.created_at from public.chat_messages c
    where c.event_id = m.id order by c.created_at desc limit 1
  ) lm on true
  left join public.profiles lp on lp.id = lm.user_id
  left join public.chat_reads cr on cr.event_id = m.id and cr.user_id = (select auth.uid())
  -- Most recent conversations first; chats nobody has written in yet go last
  order by lm.created_at desc nulls last, m.date;
$$;

revoke execute on function public.mark_chat_read(uuid) from public, anon;
revoke execute on function public.get_my_chats() from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.get_my_chats() to authenticated;

------------------------------------------------------------------------------
-- Activity: notifications, written only by the triggers below
------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,      -- who sees it
  type text not null check (type in ('joined', 'rsvp', 'event_updated', 'event_cancelled')),
  -- Set null (not cascade) so "event cancelled" survives the event's deletion
  event_id uuid references public.events on delete set null,
  actor_id uuid references auth.users on delete set null,             -- who caused it
  -- Event title, new RSVP status, and the actor's name at the time (profiles
  -- stop being visible once you no longer share an event, e.g. after a cancellation)
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "Users see their own notifications" on public.notifications;
drop policy if exists "Users mark their own notifications read" on public.notifications;
create policy "Users see their own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users mark their own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Clients may only flip read_at; rows are created by triggers
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.mark_notifications_read()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
$$;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Host hears about guests joining and answering
create or replace function private.notify_rsvp_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = new.event_id;
  if v_event.id is null or v_event.host_id = new.user_id then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    values (v_event.host_id, 'joined', v_event.id, new.user_id,
            jsonb_build_object('title', v_event.title, 'actor_name', (select full_name from public.profiles where id = new.user_id)));
  elsif new.status is distinct from old.status and new.status in ('yes', 'maybe', 'no') then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    values (v_event.host_id, 'rsvp', v_event.id, new.user_id,
            jsonb_build_object('title', v_event.title, 'status', new.status, 'actor_name', (select full_name from public.profiles where id = new.user_id)));
  end if;
  return new;
end;
$$;

drop trigger if exists on_rsvp_notify on public.rsvps;
create trigger on_rsvp_notify after insert or update of status on public.rsvps
  for each row execute procedure private.notify_rsvp_change();

-- Guests hear about changes that matter (when, where, what) and cancellations
create or replace function private.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes text[] := '{}';
begin
  if tg_op = 'DELETE' then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select r.user_id, 'event_cancelled', old.id, old.host_id,
           jsonb_build_object('title', old.title, 'actor_name', (select full_name from public.profiles where id = old.host_id))
    from public.rsvps r where r.event_id = old.id and r.status <> 'no';
    return old;
  end if;

  if new.date is distinct from old.date or new.end_date is distinct from old.end_date then v_changes := array_append(v_changes, 'time'); end if;
  if new.address is distinct from old.address or new.venue_name is distinct from old.venue_name then v_changes := array_append(v_changes, 'place'); end if;
  if new.title is distinct from old.title then v_changes := array_append(v_changes, 'name'); end if;

  if array_length(v_changes, 1) > 0 then
    insert into public.notifications (user_id, type, event_id, actor_id, data)
    select r.user_id, 'event_updated', new.id, new.host_id,
           jsonb_build_object('title', new.title, 'changes', to_jsonb(v_changes), 'actor_name', (select full_name from public.profiles where id = new.host_id))
    from public.rsvps r where r.event_id = new.id and r.status <> 'no';
  end if;
  return new;
end;
$$;

drop trigger if exists on_event_update_notify on public.events;
create trigger on_event_update_notify after update on public.events
  for each row execute procedure private.notify_event_change();
drop trigger if exists on_event_delete_notify on public.events;
create trigger on_event_delete_notify before delete on public.events
  for each row execute procedure private.notify_event_change();

revoke execute on function private.notify_rsvp_change() from public, anon, authenticated;
revoke execute on function private.notify_event_change() from public, anon, authenticated;

-- Live badge updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
