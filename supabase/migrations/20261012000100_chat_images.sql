-- Chat images: a message can carry an image instead of text.
-- (Renamed from 20261012000000_chat_images.sql, which shared its version with
-- the album migration and used `create policy if not exists`, which Postgres
-- doesn't have.)

-- We store the storage path, not a URL, so the database can check the image
-- really is the sender's own upload, and so it survives a change of project URL
alter table public.chat_messages alter column content drop not null;
alter table public.chat_messages drop column if exists image_url;
alter table public.chat_messages add column if not exists image_path text;

-- Every message is text or an image (never empty)
alter table public.chat_messages drop constraint if exists chat_messages_has_body;
alter table public.chat_messages add constraint chat_messages_has_body
  check (nullif(btrim(content), '') is not null or image_path is not null);

-- Only an image from the sender's own chat folder: event-images/chat/<uid>/<file>
alter table public.chat_messages drop constraint if exists chat_messages_image_path_own;
alter table public.chat_messages add constraint chat_messages_image_path_own
  check (image_path is null or image_path ~ ('^chat/' || user_id::text || '/[^/]+$'));

-- Storage: uploads into your own chat folder. Reading is public by URL like
-- covers; "Users can delete own event images" already covers deletes.
drop policy if exists "Users upload chat images to own folder" on storage.objects;
create policy "Users upload chat images to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
drop policy if exists "Users delete own chat images" on storage.objects;

-- Chat list: an image-only last message previews as "📷 Photo"
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
         coalesce(lm.content, case when lm.image_path is not null then '📷 Photo' end),
         lm.user_id, lp.full_name, lm.created_at,
         (
           select count(*)::int from public.chat_messages c
           where c.event_id = m.id
             and c.user_id <> (select auth.uid())
             and c.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)
         )
  from mine m
  left join lateral (
    select c.content, c.image_path, c.user_id, c.created_at from public.chat_messages c
    where c.event_id = m.id order by c.created_at desc limit 1
  ) lm on true
  left join public.profiles lp on lp.id = lm.user_id
  left join public.chat_reads cr on cr.event_id = m.id and cr.user_id = (select auth.uid())
  -- Most recent conversations first; chats nobody has written in yet go last
  order by lm.created_at desc nulls last, m.date;
$$;
