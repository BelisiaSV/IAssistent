-- =============================================================================
-- Fase 3c: Tactical Coach — tegenstanders, hun opstelling, wedstrijdevaluaties,
-- en meerdere taken per rol (wedstrijdplan, oefenstof uittekenen).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Opponents of a team (fiche)
-- -----------------------------------------------------------------------------
create table public.opponents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  play_style text check (play_style is null or length(play_style) <= 1000),
  strengths text check (strengths is null or length(strengths) <= 1000),
  weaknesses text check (weaknesses is null or length(weaknesses) <= 1000),
  set_pieces text check (set_pieces is null or length(set_pieces) <= 1000),
  notes text check (notes is null or length(notes) <= 2000),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index opponents_team_name_unique on public.opponents (team_id, lower(trim(name)));

create trigger opponents_set_updated_at before update on public.opponents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Opponent lineups: shirt number + name per slot and bench. Entered by the coach
-- (e.g. from the RBFA app); later also by the Video Analyst (source = 'video').
-- -----------------------------------------------------------------------------
create table public.opponent_lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent_id uuid not null references public.opponents (id) on delete cascade,
  match_date date,
  source text not null default 'coach' check (source in ('coach', 'video')),
  -- Formation code from /staff/_gedeeld/formaties.json
  formation text not null check (length(formation) between 1 and 20),
  -- { "<slot id>": { "number": 9, "name": "..." } }
  starters jsonb not null default '{}'::jsonb check (jsonb_typeof(starters) = 'object'),
  -- [{ "number": 12, "name": "..." }]
  bench jsonb not null default '[]'::jsonb
    check (jsonb_typeof(bench) = 'array' and jsonb_array_length(bench) <= 12),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opponent_lineups_opponent_idx on public.opponent_lineups (opponent_id, updated_at desc);

create trigger opponent_lineups_set_updated_at before update on public.opponent_lineups
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Match reports: findings of the head coach after a match.
-- -----------------------------------------------------------------------------
create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  match_date date not null,
  opponent_id uuid references public.opponents (id) on delete set null,
  opponent_name text not null check (length(trim(opponent_name)) between 1 and 120),
  home boolean,
  goals_for smallint check (goals_for between 0 and 50),
  goals_against smallint check (goals_against between 0 and 50),
  own_formation text check (own_formation is null or length(own_formation) <= 20),
  opponent_formation text check (opponent_formation is null or length(opponent_formation) <= 20),
  went_well text check (went_well is null or length(went_well) <= 2000),
  went_badly text check (went_badly is null or length(went_badly) <= 2000),
  lessons text check (lessons is null or length(lessons) <= 2000),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, match_date)
);

create trigger match_reports_set_updated_at before update on public.match_reports
  for each row execute function public.set_updated_at();

-- Opponent and lineup/report belong to the same team.
create function public.check_opponent_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opponent_id is not null and not exists (
    select 1 from public.opponents o where o.id = new.opponent_id and o.team_id = new.team_id
  ) then
    raise exception 'opponent does not belong to the team' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger opponent_lineups_check_team before insert or update on public.opponent_lineups
  for each row execute function public.check_opponent_team();
create trigger match_reports_check_team before insert or update on public.match_reports
  for each row execute function public.check_opponent_team();

-- -----------------------------------------------------------------------------
-- Staff proposals: a role can have several tasks (e.g. tactical-coach:
-- 'default' = match plan, 'oefenstof' = drawing the exercises).
-- -----------------------------------------------------------------------------
alter table public.staff_proposals
  add column task text not null default 'default' check (task ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$');
alter table public.staff_proposals
  drop constraint staff_proposals_week_plan_id_role_version_key;
alter table public.staff_proposals
  add constraint staff_proposals_week_role_task_version_key unique (week_plan_id, role, task, version);

create or replace function public.before_staff_proposal_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
begin
  if not exists (
    select 1 from public.week_plans w where w.id = new.week_plan_id and w.team_id = new.team_id
  ) then
    raise exception 'week plan does not belong to the team' using errcode = 'check_violation';
  end if;

  if new.provider <> 'example' and (
    select count(*) from public.staff_proposals p
    where p.created_by = new.created_by and p.provider <> 'example' and p.created_at >= v_today_start
  ) >= public.staff_daily_limit() then
    raise exception 'daily limit of staff proposals reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;

  -- Serialise version numbers per week, role and task.
  perform pg_advisory_xact_lock(hashtext(new.week_plan_id::text || new.role || new.task));
  select coalesce(max(version), 0) + 1 into new.version
  from public.staff_proposals
  where week_plan_id = new.week_plan_id and role = new.role and task = new.task;

  return new;
end;
$$;

-- Lineups proposed by a staff role are marked as such.
alter table public.lineups
  add column source text not null default 'coach' check (source in ('coach', 'tactical-coach'));

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.opponents enable row level security;
alter table public.opponent_lineups enable row level security;
alter table public.match_reports enable row level security;
revoke all on public.opponents, public.opponent_lineups, public.match_reports from anon;
revoke execute on function public.check_opponent_team() from anon, public;
revoke execute on function public.before_staff_proposal_insert() from anon, public;

create policy "opponents: read" on public.opponents
  for select to authenticated using (public.can_read_team(team_id));
create policy "opponents: head coach inserts" on public.opponents
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "opponents: head coach updates" on public.opponents
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "opponents: head coach deletes" on public.opponents
  for delete to authenticated using (public.can_write_team(team_id));

create policy "opponent_lineups: read" on public.opponent_lineups
  for select to authenticated using (public.can_read_team(team_id));
create policy "opponent_lineups: head coach inserts" on public.opponent_lineups
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "opponent_lineups: head coach updates" on public.opponent_lineups
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "opponent_lineups: head coach deletes" on public.opponent_lineups
  for delete to authenticated using (public.can_write_team(team_id));

create policy "match_reports: read" on public.match_reports
  for select to authenticated using (public.can_read_team(team_id));
create policy "match_reports: head coach inserts" on public.match_reports
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "match_reports: head coach updates" on public.match_reports
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "match_reports: head coach deletes" on public.match_reports
  for delete to authenticated using (public.can_write_team(team_id));
