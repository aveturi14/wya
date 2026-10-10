-- Design refresh R.6: hosts pick a color theme per event. Safe to re-run.
-- The names must match constants/eventThemes.ts.

alter table public.events
  add column if not exists theme text not null
  default (array['lime', 'bubblegum', 'violet', 'tangerine', 'ocean', 'sunset'])[floor(random() * 6)::int + 1];

alter table public.events drop constraint if exists events_theme_check;
alter table public.events
  add constraint events_theme_check check (theme in ('lime', 'bubblegum', 'violet', 'tangerine', 'ocean', 'sunset'));

-- The invite page is themed before login, so the preview returns the theme.
-- Changing a function's result columns requires dropping it first.
drop function if exists public.get_invite_preview(text);
create function public.get_invite_preview(p_code text)
returns table (event_id uuid, title text, date timestamptz, host_name text, cover_image text, theme text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.date, p.full_name, e.cover_image, e.theme
  from public.event_invites i
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = e.host_id
  where i.code = p_code;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';
