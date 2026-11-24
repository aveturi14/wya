-- Dev-only: 30 extra guests for the pledge stress test (supabase/tests/stress_pledges.py).
-- NEVER run against production. Same password as supabase/seed.sql. Run with:
--   psql "$SUPABASE_DB_URL" -v test_password="$WYA_TEST_PASSWORD" -f supabase/seed_stress.sql
-- Emails stress01@wya.test … stress30@wya.test. Safe to re-run.

with people (id, email, full_name) as (values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'stress01@wya.test', 'Ava Allen'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 'stress02@wya.test', 'Ben Brooks'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'stress03@wya.test', 'Chloe Chen'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 'stress04@wya.test', 'Dan Dempsey'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 'stress05@wya.test', 'Ella Evans'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006', 'stress06@wya.test', 'Finn Foster'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 'stress07@wya.test', 'Grace Gupta'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000008', 'stress08@wya.test', 'Harry Hughes'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000009', 'stress09@wya.test', 'Isla Ito'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000010', 'stress10@wya.test', 'Jack Jones'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000011', 'stress11@wya.test', 'Kate Kelly'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'stress12@wya.test', 'Liam Lee'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000013', 'stress13@wya.test', 'Mia Moore'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000014', 'stress14@wya.test', 'Noah Nguyen'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000015', 'stress15@wya.test', 'Olivia Ortiz'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000016', 'stress16@wya.test', 'Paddy Park'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000017', 'stress17@wya.test', 'Quinn Quigley'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000018', 'stress18@wya.test', 'Ruby Ross'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000019', 'stress19@wya.test', 'Sam Singh'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000020', 'stress20@wya.test', 'Tara Tran'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000021', 'stress21@wya.test', 'Uma Usman'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000022', 'stress22@wya.test', 'Vik Varma'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000023', 'stress23@wya.test', 'Will Walsh'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000024', 'stress24@wya.test', 'Xena Xu'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000025', 'stress25@wya.test', 'Yasmin Young'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000026', 'stress26@wya.test', 'Zac Zhang'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000027', 'stress27@wya.test', 'Amelia Ashby'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000028', 'stress28@wya.test', 'Leo Lam'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000029', 'stress29@wya.test', 'Priya Patel'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000030', 'stress30@wya.test', 'Oscar Owens')
), users as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,
    crypt(:'test_password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(), '', '', '', ''
  from people
  on conflict (id) do nothing
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from users
on conflict do nothing;
