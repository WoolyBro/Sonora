-- Sonora — Supabase schema
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Design notes
--   * Tracks live in src/data/catalog.json, so track_id is a text slug, not a FK.
--   * Every table is protected by Row Level Security: a user can only ever see
--     or change their own rows. The anon key is safe to expose because of this.
--   * mood_entries never stores the raw check-in text unless the user ticks
--     "save my words" (the `note` column), which the app leaves null by default.
--   * Deleting an auth user cascades to all of their rows.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  preferences   jsonb not null default '{}'::jsonb,   -- { vocals, genres[], analysis, journal }
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.favourites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  track_id    text not null check (char_length(track_id) <= 80),
  created_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.playlists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  description  text check (char_length(description) <= 280),
  created_at   timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id  uuid not null references public.playlists (id) on delete cascade,
  track_id     text not null check (char_length(track_id) <= 80),
  position     integer not null check (position >= 0),
  primary key (playlist_id, track_id)
);

create table if not exists public.listening_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  track_id   text not null check (char_length(track_id) <= 80),
  played_at  timestamptz not null default now()
);
create index if not exists listening_history_user_played on public.listening_history (user_id, played_at desc);

create table if not exists public.mood_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  primary_emotion     text not null check (primary_emotion in (
                        'LOW_SAD','ANXIOUS_WORRIED','ANGRY_FRUSTRATED','STRESSED_OVERWHELMED',
                        'NUMB_DISCONNECTED','POSITIVE_JOYFUL','AFFECTIONATE_CONNECTED','CALM_PEACEFUL')),
  secondary_emotions  text[] not null default '{}',
  intensity           real not null check (intensity between 0 and 1),
  source              text not null check (source in ('claude','on-device','manual')),
  note                text check (char_length(note) <= 1200),   -- only if the user opts in
  created_at          timestamptz not null default now()
);
create index if not exists mood_entries_user_created on public.mood_entries (user_id, created_at desc);

-- ───────────── Row Level Security ─────────────
alter table public.profiles          enable row level security;
alter table public.favourites        enable row level security;
alter table public.playlists         enable row level security;
alter table public.playlist_tracks   enable row level security;
alter table public.listening_history enable row level security;
alter table public.mood_entries      enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own favourites" on public.favourites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own playlists" on public.playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tracks of own playlists" on public.playlist_tracks
  for all using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));

create policy "own history" on public.listening_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own mood entries" on public.mood_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at fresh on profile edits.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
