-- Sign-up failed with 'relation "profiles" does not exist': the auth service
-- runs the trigger with its own search_path, so the table must be
-- schema-qualified. Also copy phone from sign-up metadata, and tolerate the
-- app having already created the row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
