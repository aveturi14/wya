-- Phase 8.2: polls in the event chat (docs/PHASE8.md §4, 8.2).
--
-- "/poll Where should we eat? Thai / Pizza / Sushi" replaces the back-and-forth
-- in the chat. A poll is a chat message of kind 'poll' (question and options
-- in `data`); votes live in their own table, one row per person per option, so
-- votes arriving at the same moment can't overwrite each other. Anyone who can
-- chat (host, Going, Maybe) can start a poll, vote, and see who voted for what.
-- Slash commands are parsed in the app; each command is its own RPC with its
-- own checks. Safe to re-run.

create table if not exists public.poll_votes (
  message_id uuid not null references public.chat_messages on delete cascade,
  -- Copied from the message, so the policy and the live-update filter don't need a join
  event_id uuid not null references public.events on delete cascade,
  option_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, option_id)
);
create index if not exists poll_votes_event_idx on public.poll_votes (event_id);
alter table public.poll_votes enable row level security;
revoke insert, update, delete on public.poll_votes from anon, authenticated;
drop policy if exists "Chat members see poll votes" on public.poll_votes;
create policy "Chat members see poll votes" on public.poll_votes for select to authenticated
  using (private.can_chat(event_id));

-- Live results while the chat is open (a DELETE carries the primary key, which includes message_id)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end $$;

create or replace function public.create_poll(p_event_id uuid, p_question text, p_options text[], p_multi boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_question text := btrim(coalesce(p_question, ''));
  v_options jsonb := '[]'::jsonb;
  v_label text;
  v_n int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not private.can_chat(p_event_id) then
    raise exception 'Only people going (or maybe) can start a poll' using errcode = '42501';
  end if;
  if length(v_question) not between 1 and 120 then
    raise exception 'A poll needs a question (up to 120 characters)' using errcode = '22023';
  end if;
  if p_options is null or cardinality(p_options) not between 2 and 6 then
    raise exception 'A poll needs 2 to 6 options' using errcode = '22023';
  end if;
  foreach v_label in array p_options loop
    v_label := btrim(coalesce(v_label, ''));
    if length(v_label) not between 1 and 60 then
      raise exception 'Each option needs 1 to 60 characters' using errcode = '22023';
    end if;
    v_n := v_n + 1;
    v_options := v_options || jsonb_build_array(jsonb_build_object('id', v_n::text, 'label', v_label));
  end loop;
  perform private.hit_rate_limit('poll:' || p_event_id, 10, interval '1 hour');
  return private.post_message(p_event_id, v_uid, 'poll', null, jsonb_build_object(
    'question', v_question, 'options', v_options, 'multi', coalesce(p_multi, false), 'closed', false
  ));
end;
$$;

-- Replaces the caller's votes on a poll. An empty list takes your vote back.
create or replace function public.vote_poll(p_message_id uuid, p_option_ids text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_poll public.chat_messages%rowtype;
  v_choices text[];
  v_valid text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_poll from public.chat_messages where id = p_message_id and kind = 'poll';
  if v_poll.id is null or not private.can_chat(v_poll.event_id) then
    raise exception 'Poll not found' using errcode = '42501';
  end if;
  if coalesce((v_poll.data->>'closed')::boolean, false) then
    raise exception 'This poll is closed' using errcode = 'P0001', hint = 'poll_closed';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_choices from unnest(coalesce(p_option_ids, '{}')) x;
  select array_agg(o->>'id') into v_valid from jsonb_array_elements(v_poll.data->'options') o;
  if not (v_choices <@ v_valid) then
    raise exception 'That isn''t one of the options' using errcode = '22023';
  end if;
  if not coalesce((v_poll.data->>'multi')::boolean, false) and cardinality(v_choices) > 1 then
    raise exception 'Pick one option' using errcode = '22023';
  end if;
  -- One change at a time per person per poll (two quick taps, or two devices)
  perform pg_advisory_xact_lock(hashtext('poll:' || p_message_id || ':' || v_uid));
  delete from public.poll_votes where message_id = p_message_id and user_id = v_uid;
  insert into public.poll_votes (message_id, event_id, option_id, user_id)
  select p_message_id, v_poll.event_id, x, v_uid from unnest(v_choices) x;
end;
$$;

-- The person who started the poll, or the host, can close it
create or replace function public.close_poll(p_message_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_poll public.chat_messages%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select * into v_poll from public.chat_messages where id = p_message_id and kind = 'poll';
  if v_poll.id is null or not (v_poll.user_id = v_uid or private.is_event_host(v_poll.event_id)) then
    raise exception 'Only the person who started the poll, or the host, can close it' using errcode = '42501';
  end if;
  update public.chat_messages set data = jsonb_set(data, '{closed}', 'true'::jsonb) where id = p_message_id;
end;
$$;

-- Votes per option, in the poll's order, and who voted (visible to everyone in
-- the chat, as in WhatsApp polls). Nothing for people who can't chat.
create or replace function public.get_poll_results(p_message_id uuid)
returns table (option_id text, label text, votes int, voter_ids uuid[], closed boolean)
language sql stable security definer set search_path = '' as $$
  select o.opt->>'id',
         o.opt->>'label',
         count(v.user_id)::int,
         coalesce(array_agg(v.user_id order by v.created_at) filter (where v.user_id is not null), '{}'::uuid[]),
         coalesce((m.data->>'closed')::boolean, false)
  from public.chat_messages m
  cross join lateral jsonb_array_elements(m.data->'options') with ordinality as o(opt, ord)
  left join public.poll_votes v on v.message_id = m.id and v.option_id = o.opt->>'id'
  where m.id = p_message_id and m.kind = 'poll' and private.can_chat(m.event_id)
  group by o.opt, o.ord, m.data
  order by o.ord;
$$;

revoke execute on function public.create_poll(uuid, text, text[], boolean) from public, anon;
revoke execute on function public.vote_poll(uuid, text[]) from public, anon;
revoke execute on function public.close_poll(uuid) from public, anon;
revoke execute on function public.get_poll_results(uuid) from public, anon;
grant execute on function public.create_poll(uuid, text, text[], boolean) to authenticated;
grant execute on function public.vote_poll(uuid, text[]) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;
grant execute on function public.get_poll_results(uuid) to authenticated;

notify pgrst, 'reload schema';
