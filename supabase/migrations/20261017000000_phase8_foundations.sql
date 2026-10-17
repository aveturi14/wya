-- Phase 8.0: foundations for smart coordination (docs/PHASE8.md §4, 8.0).
--
--  * Typed chat messages: polls, splits, plans and the assistant's replies
--    live in the chat as cards, so a message gets a `kind` and structured
--    `data`. Clients may only write plain text and images; every other kind
--    is written by security-definer functions, so a card can't be faked.
--  * The assistant (`bot`) and the app (`system`) post with no sender.
--  * Messages get their time from the server (clients could backdate them).
--  * Rate limits shared by polls, splits, invites and Edge Functions.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Typed chat messages
------------------------------------------------------------------------------
alter table public.chat_messages add column if not exists kind text not null default 'text';
alter table public.chat_messages add column if not exists data jsonb;
alter table public.chat_messages alter column user_id drop not null;

-- Image-only messages written before kinds existed
update public.chat_messages set kind = 'image'
where kind = 'text' and image_path is not null and nullif(btrim(content), '') is null;

alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'image', 'poll', 'split', 'plan', 'bot', 'system'));

-- Only the assistant and the app post without a sender, and they always do
alter table public.chat_messages drop constraint if exists chat_messages_sender_check;
alter table public.chat_messages add constraint chat_messages_sender_check
  check ((kind in ('bot', 'system')) = (user_id is null));

-- Never an empty message; cards carry their content in `data`
alter table public.chat_messages drop constraint if exists chat_messages_has_body;
alter table public.chat_messages add constraint chat_messages_has_body
  check (case
    when kind = 'text' then nullif(btrim(content), '') is not null or image_path is not null
    when kind = 'image' then image_path is not null
    when kind in ('bot', 'system') then nullif(btrim(content), '') is not null
    else data is not null
  end);

-- Chat loads and the Chats tab both read an event's messages newest first
create index if not exists chat_messages_event_created_idx on public.chat_messages (event_id, created_at desc);

-- Clients write only these columns: not `data`, not `created_at`, not `id`
revoke insert on public.chat_messages from anon, authenticated;
grant insert (event_id, user_id, content, image_path, kind) on public.chat_messages to authenticated;

drop policy if exists "Users can send messages if RSVP yes/maybe or host" on public.chat_messages;
create policy "Users can send messages if RSVP yes/maybe or host" on public.chat_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and kind in ('text', 'image')
    and data is null
    and private.can_chat(event_id)
  );

-- How security-definer functions (polls, splits, plans) post a card.
-- Not callable over the API: the private schema isn't exposed and execute is revoked.
create or replace function private.post_message(
  p_event_id uuid, p_user_id uuid, p_kind text, p_content text, p_data jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.chat_messages (event_id, user_id, kind, content, data)
  values (p_event_id, p_user_id, p_kind, p_content, p_data)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.post_message(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- How the assistant's Edge Functions reply in a chat: service role only
create or replace function public.post_bot_message(p_event_id uuid, p_text text, p_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(btrim(p_text), '') is null then
    raise exception 'A reply needs some text' using errcode = '22023';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  return private.post_message(p_event_id, null, 'bot', left(btrim(p_text), 4000), coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke execute on function public.post_bot_message(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.post_bot_message(uuid, text, jsonb) to service_role;

------------------------------------------------------------------------------
-- Chats tab: previews for the new kinds; replies from wya count as unread
------------------------------------------------------------------------------
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
-- Rate limits (fixed windows). Callers raise `rate_limited` (hint) past the limit.
------------------------------------------------------------------------------
create table if not exists private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create or replace function private.hit_rate_limit(p_key text, p_max int, p_window interval)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_seconds double precision := extract(epoch from p_window);
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > p_max then
    raise exception 'You''re doing that a lot. Try again a bit later.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
end;
$$;
revoke execute on function private.hit_rate_limit(text, int, interval) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wya-rate-limit-cleanup';
  perform cron.schedule('wya-rate-limit-cleanup', '17 3 * * *',
    $job$delete from private.rate_limits where window_start < now() - interval '2 days'$job$);
end $$;
