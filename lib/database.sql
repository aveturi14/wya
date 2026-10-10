-- OUTDATED: this is the original schema, kept for reference. The real schema is
-- supabase/migrations/ (applied in order); don't run this file on its own.

-- Run this in your Supabase SQL editor to set up the database

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();

-- Events
create table events (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  date timestamptz not null,
  end_date timestamptz,
  venue_name text,
  address text not null,
  latitude float,
  longitude float,
  dress_code text,
  notes text,
  cover_image text,
  venue_images text[] default '{}',
  contact_numbers text[] default '{}',
  is_private boolean default false,
  invite_code text unique default substr(md5(random()::text), 1, 10),
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Events viewable by all" on events for select using (true);
create policy "Hosts can create events" on events for insert with check (auth.uid() = host_id);
create policy "Hosts can update events" on events for update using (auth.uid() = host_id);
create policy "Hosts can delete events" on events for delete using (auth.uid() = host_id);

-- RSVPs
create table rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  status text check (status in ('yes','no','maybe')) not null,
  additional_details text,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);
alter table rsvps enable row level security;
create policy "RSVPs viewable by event host and self" on rsvps for select
  using (auth.uid() = user_id or auth.uid() = (select host_id from events where id = event_id));
create policy "Users can manage own RSVPs" on rsvps for insert with check (auth.uid() = user_id);
create policy "Users can update own RSVPs" on rsvps for update using (auth.uid() = user_id);

-- Chat messages
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);
alter table chat_messages enable row level security;
create policy "Chat viewable by RSVP yes/maybe or host" on chat_messages for select
  using (
    auth.uid() = (select host_id from events where id = event_id)
    or auth.uid() in (select user_id from rsvps where event_id = chat_messages.event_id and status in ('yes','maybe'))
  );
create policy "Users can send messages if RSVP yes/maybe or host" on chat_messages for insert
  with check (
    auth.uid() = user_id and (
      auth.uid() = (select host_id from events where id = event_id)
      or auth.uid() in (select user_id from rsvps where event_id = chat_messages.event_id and status in ('yes','maybe'))
    )
  );

-- Storage bucket for event images
insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true);
create policy "Anyone can view event images" on storage.objects for select using (bucket_id = 'event-images');
create policy "Authenticated users can upload event images" on storage.objects for insert
  with check (bucket_id = 'event-images' and auth.role() = 'authenticated');

-- Storage bucket for avatars
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
