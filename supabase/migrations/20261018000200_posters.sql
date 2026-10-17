-- Phase 9.3: event posters. Safe to re-run.
--   * events.poster_line: the italic serif line on the poster ("Jess turns"), up to 40 characters
--   * events.stickers: up to two stickers the host writes ("bring a plus one"), each up to 24 characters
--   * seven two-colour looks (constants/eventThemes.ts); the old names are mapped:
--       lime → lime, violet → violet, ocean → ocean, bubblegum → violet, tangerine → sunset, sunset → peach
--   * get_invite_preview returns what a logged-out invite needs to draw the poster and explain the
--     pledge: the serif line, stickers, venue name (never the address), going/maybe counts, the
--     pledge settings, and 'full' as a link status when the guest limit is reached.

alter table public.events add column if not exists poster_line text;
alter table public.events add column if not exists stickers text[] not null default '{}';

alter table public.events drop constraint if exists events_poster_line_check;
alter table public.events add constraint events_poster_line_check
  check (poster_line is null or char_length(poster_line) <= 40);

alter table public.events drop constraint if exists events_stickers_check;
alter table public.events add constraint events_stickers_check
  check (cardinality(stickers) <= 2
         and coalesce(char_length(stickers[1]), 0) <= 24
         and coalesce(char_length(stickers[2]), 0) <= 24);

-- Rename the looks once. "sunset" means something different before and after (it becomes
-- peach, and tangerine becomes sunset), so only map while the old constraint is still there.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'events_theme_check' and conrelid = 'public.events'::regclass
      and pg_get_constraintdef(oid) like '%bubblegum%'
  ) then
    alter table public.events drop constraint events_theme_check;
    update public.events set theme = case theme
      when 'sunset' then 'peach'
      when 'tangerine' then 'sunset'
      when 'bubblegum' then 'violet'
      else theme end
    where theme in ('sunset', 'tangerine', 'bubblegum');
  end if;
end $$;

alter table public.events
  alter column theme set default (array['sunset', 'violet', 'ocean', 'lime', 'peach', 'tomato', 'midnight'])[floor(random() * 7)::int + 1];
alter table public.events drop constraint if exists events_theme_check;
alter table public.events
  add constraint events_theme_check check (theme in ('sunset', 'violet', 'ocean', 'lime', 'peach', 'tomato', 'midnight'));

-- events.address isn't selectable, so readable columns are granted one by one (see address_gating).
-- Inserts and updates are table-level, so hosts can already write the new columns.
grant select (poster_line, stickers) on public.events to authenticated;

drop function if exists public.get_invite_preview(text);
create function public.get_invite_preview(p_code text)
returns table (event_id uuid, title text, date timestamptz, host_name text, cover_image text, theme text,
               requires_approval boolean, link_status text,
               poster_line text, stickers text[], venue_name text, kind text,
               going_count int, maybe_count int,
               deposit_mode text, deposit_cents int, cutoff_hours int)
language sql
stable
security definer
set search_path = ''
as $$
  with link as (
    select i.event_id, i.requires_approval,
           case when i.expires_at is not null and now() >= i.expires_at then 'expired'
                when i.max_uses is not null and i.uses >= i.max_uses then 'used_up'
                else 'open' end as link_status
    from public.event_invites i where i.code = p_code
    union all
    select pi.event_id, false,
           case when pi.used_by is not null and pi.used_by is distinct from (select auth.uid()) then 'used_up' else 'open' end
    from public.event_personal_invites pi where pi.code = p_code
  ),
  counts as (
    select r.event_id,
           count(*) filter (where r.status = 'yes')::int as going,
           count(*) filter (where r.status = 'maybe')::int as maybe
    from public.rsvps r
    where r.event_id in (select event_id from link)
    group by r.event_id
  )
  select e.id, e.title, e.date, p.full_name, e.cover_image, e.theme, l.requires_approval,
         -- Full only matters while the link itself still works; people already in aren't turned away here
         case when l.link_status = 'open' and e.max_guests is not null and coalesce(c.going, 0) >= e.max_guests
                   and not exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = (select auth.uid()))
              then 'full' else l.link_status end,
         e.poster_line, e.stickers, e.venue_name, e.kind,
         coalesce(c.going, 0), coalesce(c.maybe, 0),
         e.deposit_mode, e.deposit_cents, e.cutoff_hours
  from link l
  join public.events e on e.id = l.event_id
  left join public.profiles p on p.id = e.host_id
  left join counts c on c.event_id = e.id;
$$;
revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';
