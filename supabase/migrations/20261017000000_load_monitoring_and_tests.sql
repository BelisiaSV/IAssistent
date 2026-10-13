-- =============================================================================
-- Fase 3b: Physical Coach — periodisering, werkelijke belasting (RPE) en testen
-- =============================================================================

-- Season settings: periodisation starts in the week of the first competition match.
alter table public.teams
  add column competition_start_date date,
  add column periodization_weeks smallint not null default 4
    check (periodization_weeks in (4, 6, 8));

-- -----------------------------------------------------------------------------
-- Actual load per session: average RPE of the group after the session.
-- AU (sRPE) = rpe * duration_min.
-- -----------------------------------------------------------------------------
create table public.session_loads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  session_date date not null,
  kind text not null check (kind in ('training', 'match')),
  rpe numeric(3, 1) not null check (rpe >= 0 and rpe <= 10),
  duration_min smallint not null check (duration_min between 1 and 300),
  attendance smallint check (attendance between 0 and 60),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, session_date, kind)
);

create index session_loads_team_date_idx on public.session_loads (team_id, session_date desc);

create trigger session_loads_set_updated_at before update on public.session_loads
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fitness test results per player (test codes from /staff/_gedeeld/testen.json).
-- -----------------------------------------------------------------------------
create table public.fitness_tests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  test_code text not null check (test_code ~ '^[a-z][a-z0-9_-]*$'),
  test_date date not null,
  result numeric(6, 2) not null check (result > 0),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, test_code, test_date)
);

create index fitness_tests_team_idx on public.fitness_tests (team_id, test_code, test_date desc);

-- A test result belongs to a player of the same team.
create function public.check_fitness_test_player()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.players p where p.id = new.player_id and p.team_id = new.team_id) then
    raise exception 'player does not belong to the team' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger fitness_tests_check_player
  before insert or update on public.fitness_tests
  for each row execute function public.check_fitness_test_player();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.session_loads enable row level security;
alter table public.fitness_tests enable row level security;
revoke all on public.session_loads, public.fitness_tests from anon;
revoke execute on function public.check_fitness_test_player() from anon, public;

create policy "session_loads: read" on public.session_loads
  for select to authenticated using (public.can_read_team(team_id));
create policy "session_loads: head coach inserts" on public.session_loads
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "session_loads: head coach updates" on public.session_loads
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "session_loads: head coach deletes" on public.session_loads
  for delete to authenticated using (public.can_write_team(team_id));

create policy "fitness_tests: read" on public.fitness_tests
  for select to authenticated using (public.can_read_team(team_id));
create policy "fitness_tests: head coach inserts" on public.fitness_tests
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "fitness_tests: head coach updates" on public.fitness_tests
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "fitness_tests: head coach deletes" on public.fitness_tests
  for delete to authenticated using (public.can_write_team(team_id));
