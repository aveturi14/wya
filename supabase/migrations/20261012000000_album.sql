-- Phase 4: a shared photo album per event (plan: docs/PLAN.md → Phase 4).
--
-- The host and Going guests add photos from the start until 30 days after;
-- everyone invited can view. Files live in a private bucket and are shown
-- through short-lived signed links. Rows are written only through RPCs.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Storage: a private bucket, JPEGs only (the app re-encodes every photo)
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

------------------------------------------------------------------------------
-- Photos
------------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key,
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  path text not null,        -- <event_id>/<user_id>/<id>.jpg
  thumb_path text not null,  -- <event_id>/<user_id>/<id>_thumb.jpg
  width int not null check (width > 0),
  height int not null check (height > 0),
  created_at timestamptz not null default now()
);
create index if not exists photos_event_created_idx on public.photos (event_id, created_at desc);
create index if not exists photos_event_user_idx on public.photos (event_id, user_id);
alter table public.photos enable row level security;

------------------------------------------------------------------------------
-- Who may do what
------------------------------------------------------------------------------
-- The caps, in one place, so a paid "bigger album" only changes this
create or replace function private.album_limits(out per_person int, out per_event int)
language sql immutable set search_path = '' as $$ select 30, 300 $$;

-- Host, or Going and not marked as a no-show; from the start until 30 days after
create or replace function private.can_add_photos(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and now() >= e.date and now() < e.date + interval '30 days'
      and (
        e.host_id = (select auth.uid())
        or exists (
          select 1 from public.rsvps r
          where r.event_id = e.id and r.user_id = (select auth.uid())
            and r.status = 'yes' and r.attended is not false
        )
      )
  );
$$;

create or replace function private.can_view_photos(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_event_host(p_event_id) or private.is_event_guest(p_event_id);
$$;

-- The event a storage path belongs to. Returns null (never errors) for paths
-- that aren't "<uuid>/…", because storage policies see every bucket's rows.
create or replace function private.album_event(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

drop policy if exists "Viewers can see photo rows" on public.photos;
create policy "Viewers can see photo rows" on public.photos for select to authenticated
  using (private.can_view_photos(event_id));
revoke insert, update, delete on public.photos from anon, authenticated;

drop policy if exists "Album: add to your own folder" on storage.objects;
drop policy if exists "Album: viewers can read" on storage.objects;
drop policy if exists "Album: owner or host can delete" on storage.objects;
create policy "Album: add to your own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'album'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and private.can_add_photos(private.album_event(name))
  );
-- Your own files stay visible to you even without access to the event, so you
-- can always delete them (storage only deletes files you can see)
create policy "Album: viewers can read" on storage.objects for select to authenticated
  using (
    bucket_id = 'album'
    and (split_part(name, '/', 2) = (select auth.uid())::text or private.can_view_photos(private.album_event(name)))
  );
create policy "Album: owner or host can delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'album'
    and (split_part(name, '/', 2) = (select auth.uid())::text or private.is_event_host(private.album_event(name)))
  );

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
-- Called after both files are uploaded. The paths are derived here, not
-- trusted from the app, and must already exist in storage.
create or replace function public.add_photo(p_event_id uuid, p_photo_id uuid, p_width int, p_height int)
returns public.photos language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_path text := p_event_id || '/' || v_uid || '/' || p_photo_id || '.jpg';
  v_thumb text := p_event_id || '/' || v_uid || '/' || p_photo_id || '_thumb.jpg';
  v_limits record;
  v_row public.photos;
begin
  select * into v_limits from private.album_limits();
  if not private.can_add_photos(p_event_id) then
    raise exception 'You can''t add photos to this album right now' using errcode = '42501';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'album' and name in (v_path, v_thumb)) <> 2 then
    raise exception 'Upload the photo first' using errcode = 'P0001';
  end if;

  -- One upload at a time per event, so simultaneous uploads can't pass the caps
  perform pg_advisory_xact_lock(hashtext('album:' || p_event_id));
  if (select count(*) from public.photos where event_id = p_event_id) >= v_limits.per_event then
    raise exception 'This album is full (% photos)', v_limits.per_event using errcode = 'P0001', hint = 'ALBUM_FULL';
  end if;
  if (select count(*) from public.photos where event_id = p_event_id and user_id = v_uid) >= v_limits.per_person then
    raise exception 'You''ve added the most photos you can (%)', v_limits.per_person using errcode = 'P0001', hint = 'YOUR_LIMIT';
  end if;

  insert into public.photos (id, event_id, user_id, path, thumb_path, width, height)
  values (p_photo_id, p_event_id, v_uid, v_path, v_thumb, p_width, p_height)
  returning * into v_row;
  return v_row;
end;
$$;

-- Your own photo, or any photo in your album. Returns the files for the app to remove.
create or replace function public.delete_photo(p_photo_id uuid)
returns table (path text, thumb_path text) language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
    with gone as (
      delete from public.photos p
      where p.id = p_photo_id
        and (p.user_id = (select auth.uid()) or private.is_event_host(p.event_id))
      returning p.path, p.thumb_path
    )
    select gone.path, gone.thumb_path from gone;
  if not found then
    raise exception 'Photo not found' using errcode = '42501';
  end if;
end;
$$;

-- Everything the Photos tab needs in one call
create or replace function public.get_album(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_limits record;
begin
  select * into v_limits from private.album_limits();
  if not private.can_view_photos(p_event_id) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event_id;
  return jsonb_build_object(
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'user_id', p.user_id, 'path', p.path, 'thumb_path', p.thumb_path,
        'width', p.width, 'height', p.height, 'created_at', p.created_at,
        'uploader_name', pr.full_name, 'uploader_avatar', pr.avatar_url
      ) order by p.created_at desc)
      from public.photos p left join public.profiles pr on pr.id = p.user_id
      where p.event_id = p_event_id
    ), '[]'::jsonb),
    'can_add', private.can_add_photos(p_event_id),
    'is_host', v_event.host_id = (select auth.uid()),
    'my_count', (select count(*) from public.photos where event_id = p_event_id and user_id = (select auth.uid())),
    'per_person', v_limits.per_person,
    'per_event', v_limits.per_event,
    'opens_at', v_event.date,
    'closes_at', v_event.date + interval '30 days'
  );
end;
$$;

------------------------------------------------------------------------------
-- Notifications: one unread "photos added" per person per event, updated as
-- more come in, so a busy album doesn't flood anyone's Activity
------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'joined', 'rsvp', 'event_updated', 'event_cancelled',
  'pledge_added', 'pledge_released', 'pledge_owed', 'payment_claimed', 'payment_disputed',
  'excuse_submitted', 'excuse_resolved', 'debt_waived', 'maybe_reminder', 'maybe_expired',
  'photos_added'
));

create or replace function private.notify_photo_added()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text := (select title from public.events where id = new.event_id);
  v_name text := (select full_name from public.profiles where id = new.user_id);
begin
  -- The host and everyone Going, except whoever added the photo
  with recipients as (
    select host_id as uid from public.events where id = new.event_id
    union
    select user_id from public.rsvps where event_id = new.event_id and status = 'yes'
  ),
  bumped as (
    update public.notifications n
    set actor_id = new.user_id,
        created_at = now(),
        data = n.data || jsonb_build_object(
          'actor_name', v_name,
          'count', coalesce((n.data->>'count')::int, 0) + 1,
          'uploaders', (
            select jsonb_agg(distinct u)
            from jsonb_array_elements_text(coalesce(n.data->'uploaders', '[]'::jsonb) || to_jsonb(new.user_id::text)) u
          )
        )
    where n.type = 'photos_added' and n.event_id = new.event_id and n.read_at is null
      and n.user_id in (select uid from recipients where uid <> new.user_id)
    returning n.user_id
  )
  insert into public.notifications (user_id, type, event_id, actor_id, data)
  select uid, 'photos_added', new.event_id, new.user_id,
         jsonb_build_object('title', v_title, 'actor_name', v_name, 'count', 1, 'uploaders', jsonb_build_array(new.user_id::text))
  from recipients
  where uid <> new.user_id and uid not in (select user_id from bumped);
  return new;
end;
$$;
drop trigger if exists on_photo_added on public.photos;
create trigger on_photo_added after insert on public.photos
  for each row execute procedure private.notify_photo_added();

------------------------------------------------------------------------------
-- Live updates while the party is on
------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
end $$;

------------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------------
revoke execute on function private.album_limits() from public, anon;
revoke execute on function private.can_add_photos(uuid) from public, anon;
revoke execute on function private.can_view_photos(uuid) from public, anon;
revoke execute on function private.album_event(text) from public, anon;
grant execute on function private.album_limits() to authenticated;
grant execute on function private.can_add_photos(uuid) to authenticated;
grant execute on function private.can_view_photos(uuid) to authenticated;
grant execute on function private.album_event(text) to authenticated;
revoke execute on function private.notify_photo_added() from public, anon, authenticated;

revoke execute on function public.add_photo(uuid, uuid, int, int) from public, anon;
revoke execute on function public.delete_photo(uuid) from public, anon;
revoke execute on function public.get_album(uuid) from public, anon;
grant execute on function public.add_photo(uuid, uuid, int, int) to authenticated;
grant execute on function public.delete_photo(uuid) to authenticated;
grant execute on function public.get_album(uuid) to authenticated;
