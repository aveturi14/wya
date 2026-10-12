-- Address gating, enforced by the database.
-- On pledge events the address is the reward for committing: guests who are
-- only invited (or said Can't go) shouldn't be able to read it, even straight
-- from the API. RLS works on rows, not columns, so:
--   1. nobody can select events.address directly any more (column grants), and
--   2. get_event_addresses() hands it out only to people allowed to see it.
-- Writing it is unchanged (hosts insert/update it as before).

-- Table-level SELECT covers every column, so swap it for a column list without
-- `address`. NOTE: a column added to events later must be added here too, or
-- the app can't read it (and `select=*` on events would fail).
revoke select on public.events from anon, authenticated;
grant select (
  id, host_id, title, description, date, end_date, venue_name, latitude, longitude,
  dress_code, notes, cover_image, venue_images, contact_numbers, created_at,
  allow_guest_invites, theme, deposit_mode, deposit_cents, cutoff_hours
) on public.events to authenticated;

-- Addresses for the given events, only where the caller may see them:
-- the host always; guests on non-pledge events; guests on pledge events once
-- they're going or maybe. Events the caller can't see simply return no row.
create or replace function public.get_event_addresses(p_event_ids uuid[])
returns table (event_id uuid, address text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.address
  from public.events e
  where e.id = any(p_event_ids)
    and (
      e.host_id = (select auth.uid())
      or exists (
        select 1 from public.rsvps r
        where r.event_id = e.id
          and r.user_id = (select auth.uid())
          and (e.deposit_mode <> 'pledge' or r.status in ('yes', 'maybe'))
      )
    );
$$;

revoke execute on function public.get_event_addresses(uuid[]) from public, anon;
grant execute on function public.get_event_addresses(uuid[]) to authenticated;
