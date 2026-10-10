-- Link chat_messages and rsvps to profiles so the API can embed sender/guest
-- profiles (e.g. select('*, profile:profiles(*)')). The existing links to
-- auth.users stay. Written to be safe to run on any environment, including
-- production whose exact state may differ from lib/database.sql.

-- Backfill missing profile rows so the new links can't fail on old users
insert into public.profiles (id, full_name)
select u.id, u.raw_user_meta_data->>'full_name'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_user_id_profiles_fkey') then
    alter table public.chat_messages
      add constraint chat_messages_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rsvps_user_id_profiles_fkey') then
    alter table public.rsvps
      add constraint rsvps_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;

  -- Live chat updates (the app subscribes to chat_messages INSERTs)
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
