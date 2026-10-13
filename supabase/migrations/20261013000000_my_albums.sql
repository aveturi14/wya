-- Phase 7: the Photos tab lists every album you can see, in one call.
--
-- Uses the same rule as get_album (private.can_view_photos: the host, or anyone
-- with an RSVP row), so it never shows an album the caller couldn't open.
-- An event is listed once its album has photos, or while it's open for adding
-- (from the start until 30 days after), so an empty, long-finished event
-- doesn't clutter the tab. Thumbnail paths come back for the mosaic; the app
-- signs them like the album does (the bucket is private). Safe to re-run.

drop function if exists public.get_my_albums();
create function public.get_my_albums()
returns table (
  event_id uuid,
  title text,
  theme text,
  cover_image text,
  starts_at timestamptz,
  photo_count int,
  thumb_paths text[],
  is_open boolean
)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    -- Narrow to the caller's own events first, then apply the album rule itself
    select e.id from public.events e where e.host_id = (select auth.uid())
    union
    select r.event_id from public.rsvps r where r.user_id = (select auth.uid())
  )
  select e.id, e.title, e.theme, e.cover_image, e.date,
         coalesce(c.n, 0)::int,
         coalesce(t.paths, '{}'::text[]),
         now() >= e.date and now() < e.date + interval '30 days'
  from candidates k
  join public.events e on e.id = k.id
  left join lateral (select count(*) as n from public.photos p where p.event_id = e.id) c on true
  left join lateral (
    select array_agg(x.thumb_path order by x.created_at desc) as paths
    from (select p.thumb_path, p.created_at from public.photos p
          where p.event_id = e.id order by p.created_at desc limit 6) x
  ) t on true
  where private.can_view_photos(e.id)
    and (coalesce(c.n, 0) > 0 or (now() >= e.date and now() < e.date + interval '30 days'))
  order by e.date desc;
$$;

revoke execute on function public.get_my_albums() from public, anon;
grant execute on function public.get_my_albums() to authenticated;
