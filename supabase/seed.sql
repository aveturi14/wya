-- Dev-only seed data for wya-dev. NEVER run against production.
-- Test accounts (password for both: wya-dev-ff3e8103):
--   host@wya.test   — hosts "Seed Dinner Party"
--   guest@wya.test  — has RSVP'd yes

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'host@wya.test', crypt('wya-dev-ff3e8103', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Hannah Host"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'guest@wya.test', crypt('wya-dev-ff3e8103', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Gary Guest"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"host@wya.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"guest@wya.test","email_verified":true}', 'email', now(), now(), now())
on conflict do nothing;

insert into public.events (id, host_id, title, description, date, venue_name, address, dress_code, notes, invite_code)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
  'Seed Dinner Party', 'A test event for development.', now() + interval '7 days',
  'Hannah''s Place', '1 Infinite Loop, Cupertino, CA', 'Smart casual', 'Bring a dessert!', 'seedinvite')
on conflict (id) do nothing;

insert into public.rsvps (event_id, user_id, status, additional_details)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'yes', 'Vegetarian, +1')
on conflict (event_id, user_id) do nothing;

insert into public.chat_messages (event_id, user_id, content)
select '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Welcome everyone!'
where not exists (select 1 from public.chat_messages where event_id = '33333333-3333-3333-3333-333333333333');
