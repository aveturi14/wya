-- Dev-only seed data for wya-dev. NEVER run against production.
-- Run with the shared test password from your git-ignored .env (never commit it):
--   set -a; . ./.env; set +a
--   psql "$SUPABASE_DB_URL" -v test_password="$WYA_TEST_PASSWORD" -f supabase/seed.sql
-- Test accounts (all share that password):
--   host@wya.test   — hosts "Seed Dinner Party"
--   guest@wya.test  — has RSVP'd yes
--   stranger@wya.test — not invited to anything (for access-control tests)
--   joiner@wya.test   — accepts the seed invite during access-control tests
-- Also created through the app's sign-up flow during testing (same password,
-- exist on wya-dev but are not created by this seed): newguest@wya.test, riley@wya.test

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'host@wya.test', crypt(:'test_password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Hannah Host"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'guest@wya.test', crypt(:'test_password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Gary Guest"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'stranger@wya.test', crypt(:'test_password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Stranger"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'joiner@wya.test', crypt(:'test_password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Jo Joiner"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"host@wya.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"guest@wya.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
   '{"sub":"55555555-5555-5555-5555-555555555555","email":"stranger@wya.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
   '{"sub":"66666666-6666-6666-6666-666666666666","email":"joiner@wya.test","email_verified":true}', 'email', now(), now(), now())
on conflict do nothing;

insert into public.events (id, host_id, title, description, date, venue_name, address, dress_code, notes)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
  'Seed Dinner Party', 'A test event for development.', now() + interval '7 days',
  'Hannah''s Place', '1 Infinite Loop, Cupertino, CA', 'Smart casual', 'Bring a dessert!')
on conflict (id) do nothing;

-- A trigger creates a random invite code; pin it so tests can use /invite/seedinvite
insert into public.event_invites (event_id, code)
values ('33333333-3333-3333-3333-333333333333', 'seedinvite')
on conflict (event_id) do update set code = excluded.code;

insert into public.rsvps (event_id, user_id, status, additional_details)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'yes', 'Vegetarian, +1')
on conflict (event_id, user_id) do nothing;

insert into public.chat_messages (event_id, user_id, content)
select '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Welcome everyone!'
where not exists (select 1 from public.chat_messages where event_id = '33333333-3333-3333-3333-333333333333');
