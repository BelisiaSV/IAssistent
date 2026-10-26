-- =============================================================================
-- Oefenstof: personal exercise library of the coach (like the vision profile it
-- belongs to the coach, not to a team), with an optional animation (JSON, drawn
-- by the app) and an optional video. Teams get display settings for animations
-- (style, colours, logo on the tokens).
-- =============================================================================

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  phase text check (phase is null or phase in ('opwarming', 'kern', 'afsluiting')),
  labels text[] not null default '{}' check (cardinality(labels) <= 20),
  min_players smallint check (min_players is null or min_players between 1 and 40),
  max_players smallint check (max_players is null or max_players between 1 and 40),
  duration_min smallint check (duration_min is null or duration_min between 1 and 120),
  organisation text check (organisation is null or length(organisation) <= 2000),
  course text[] not null default '{}' check (cardinality(course) <= 30),
  coaching_points text[] not null default '{}' check (cardinality(coaching_points) <= 30),
  variations text[] not null default '{}' check (cardinality(variations) <= 30),
  -- Animation in the app format (validated by the app before saving).
  animation jsonb check (animation is null or jsonb_typeof(animation) = 'object'),
  -- Path in the bucket exercise-videos: <coach_id>/<exercise_id>/<file>
  video_path text check (video_path is null or video_path like coach_id::text || '/' || id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_players is null or max_players is null or min_players <= max_players)
);

create index exercises_coach_idx on public.exercises (coach_id, updated_at desc);

create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

alter table public.exercises enable row level security;
revoke all on public.exercises from anon;

create policy "exercises: own" on public.exercises
  for select to authenticated using (coach_id = (select auth.uid()));
create policy "exercises: create own" on public.exercises
  for insert to authenticated with check (coach_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises
  for update to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using (coach_id = (select auth.uid()));

-- Display settings for animations per team (style, colours, logo on tokens).
alter table public.teams
  add column animation_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(animation_settings) = 'object');

-- -----------------------------------------------------------------------------
-- Storage: exercise videos (path: <coach_id>/<exercise_id>/<file>), private.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  false,
  52428800, -- 50 MB
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
on conflict (id) do nothing;

-- The first path segment is the owner (a uuid); same parsing as team logos.
create policy "exercise-videos: read own" on storage.objects
  for select to authenticated using (
    bucket_id = 'exercise-videos' and public.team_id_from_storage_path(name) = (select auth.uid())
  );
create policy "exercise-videos: upload own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'exercise-videos' and public.team_id_from_storage_path(name) = (select auth.uid())
  );
create policy "exercise-videos: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'exercise-videos' and public.team_id_from_storage_path(name) = (select auth.uid()))
  with check (bucket_id = 'exercise-videos' and public.team_id_from_storage_path(name) = (select auth.uid()));
create policy "exercise-videos: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'exercise-videos' and public.team_id_from_storage_path(name) = (select auth.uid())
  );
