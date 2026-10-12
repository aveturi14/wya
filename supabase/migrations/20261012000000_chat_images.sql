-- Chat images: allow messages to carry an image alongside (or instead of) text.
-- image_url is a public storage URL from the event-images/chat/ folder.
-- content becomes nullable so a message can be image-only.

alter table public.chat_messages
  alter column content drop not null,
  add column if not exists image_url text;

-- Storage: chat images live under event-images/chat/<uid>/
-- Re-use the existing event-images bucket; policies already allow
-- authenticated users to upload to their own <uid>/ paths.
-- Insert policy covers upload; select is public (bucket is public-read).
insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true)
  on conflict (id) do nothing;

-- Allow users to upload chat images into their own folder
create policy if not exists "Users upload chat images to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow users to delete their own chat images
create policy if not exists "Users delete own chat images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
