-- Phase 7: let the test scripts clear the Activity items they cause.
--
-- rls_check.py and stress_pledges.py create, change and delete events with the
-- seed accounts invited (and flip Gary's answer on the seed event), which used
-- to leave "Hannah cancelled Album test…" and friends in those accounts'
-- Activity forever. Users can't delete notifications (by design), so this is
-- a deliberately narrow way out:
--   * only the caller's own notifications (nobody else's are touched);
--   * only for accounts on the reserved test domain (…@wya.test), so a real
--     account can't use it at all;
--   * only items about events whose titles the test scripts use, plus,
--     when the script passes the time its run started, anything that arrived
--     during the run (e.g. "Gary might come to Seed Dinner Party").
-- Marking them read instead would still leave them listed under "Earlier".
-- Safe to re-run.

drop function if exists public.clear_test_notifications();
drop function if exists public.clear_test_notifications(timestamptz);
create function public.clear_test_notifications(p_since timestamptz default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
begin
  if v_uid is null or coalesce((select u.email from auth.users u where u.id = v_uid), '') not like '%@wya.test' then
    raise exception 'Only test accounts can do this' using errcode = '42501';
  end if;
  delete from public.notifications n
  where n.user_id = v_uid
    and (
      n.data->>'title' ~ '^(RLS temp event|No PayID party|Pledge test: |Album test: |Chat image test|Address gating test|Stress test: )'
      or (p_since is not null and n.created_at >= p_since)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.clear_test_notifications(timestamptz) from public, anon;
grant execute on function public.clear_test_notifications(timestamptz) to authenticated;
