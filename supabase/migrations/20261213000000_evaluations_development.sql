-- =============================================================================
-- Evaluations and development (club module "evaluations", per team for every
-- head coach).
--
--   * training_evaluations: the head coach's evaluation of a training (one per
--     team and date): rating, what went well, what to improve and attention
--     points (codes from staff/_gedeeld/evaluatie.json).
--   * team_goals with their history (team_goal_updates, written by a trigger):
--     title, status, progress; the club follows them through the season.
--   * player_goals: individual development goals, only when the team switched
--     them on (teams.player_goals_enabled).
-- Read: can_read_team (so also the club's owner, admin, technical director and
-- the team's staff); write: can_write_team (the head coach).
-- =============================================================================

alter table public.teams add column player_goals_enabled boolean not null default false;

create table public.training_evaluations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  session_date date not null,
  rating smallint check (rating between 1 and 5),
  went_well text check (went_well is null or length(went_well) <= 1000),
  to_improve text check (to_improve is null or length(to_improve) <= 1000),
  -- Codes of attention points (staff/_gedeeld/evaluatie.json)
  attention_points text[] not null default '{}'
    check (cardinality(attention_points) <= 10 and array_to_string(attention_points, ',') ~ '^([a-z][a-z_]{0,39}(,|$))*$'),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, session_date)
);

create table public.team_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text check (description is null or length(description) <= 1000),
  target_date date,
  status text not null default 'open' check (status in ('open', 'on_track', 'at_risk', 'achieved', 'dropped')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_goal_updates (
  id bigint generated always as identity primary key,
  goal_id uuid not null references public.team_goals (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  status text not null,
  progress smallint not null,
  created_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.player_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  note text check (note is null or length(note) <= 1000),
  target_date date,
  status text not null default 'open' check (status in ('open', 'on_track', 'at_risk', 'achieved', 'dropped')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_evaluations_team_idx on public.training_evaluations (team_id, session_date desc);
create index team_goals_team_idx on public.team_goals (team_id, created_at);
create index team_goal_updates_goal_idx on public.team_goal_updates (goal_id, created_at);
create index player_goals_team_idx on public.player_goals (team_id, player_id);

create trigger training_evaluations_set_updated_at before update on public.training_evaluations
  for each row execute function public.set_updated_at();
create trigger team_goals_set_updated_at before update on public.team_goals
  for each row execute function public.set_updated_at();
create trigger player_goals_set_updated_at before update on public.player_goals
  for each row execute function public.set_updated_at();

-- Every new goal and every change of status or progress is kept (progress through the season).
create function public.after_team_goal_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.progress is distinct from old.progress then
    insert into public.team_goal_updates (goal_id, team_id, status, progress, created_by)
    values (new.id, new.team_id, new.status, new.progress, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger team_goals_after_change after insert or update on public.team_goals
  for each row execute function public.after_team_goal_change();

-- A player goal belongs to a player of the same team, and only when the team switched them on.
create function public.before_player_goal_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.players p where p.id = new.player_id and p.team_id = new.team_id) then
    raise exception 'player is not in this team' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.teams t where t.id = new.team_id and t.player_goals_enabled) then
    raise exception 'player goals are off for this team' using errcode = 'check_violation', hint = 'player_goals_off';
  end if;
  return new;
end;
$$;

create trigger player_goals_before_write before insert or update on public.player_goals
  for each row execute function public.before_player_goal_write();

alter table public.training_evaluations enable row level security;
alter table public.team_goals enable row level security;
alter table public.team_goal_updates enable row level security;
alter table public.player_goals enable row level security;
revoke all on public.training_evaluations, public.team_goals, public.team_goal_updates, public.player_goals
  from anon, authenticated, public;
grant select, insert, update, delete on public.training_evaluations, public.team_goals, public.player_goals to authenticated;
grant select on public.team_goal_updates to authenticated;

create policy "training_evaluations: read" on public.training_evaluations
  for select to authenticated using (public.can_read_team(team_id));
create policy "training_evaluations: head coach adds" on public.training_evaluations
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "training_evaluations: head coach updates" on public.training_evaluations
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "training_evaluations: head coach deletes" on public.training_evaluations
  for delete to authenticated using (public.can_write_team(team_id));

create policy "team_goals: read" on public.team_goals
  for select to authenticated using (public.can_read_team(team_id));
create policy "team_goals: head coach adds" on public.team_goals
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "team_goals: head coach updates" on public.team_goals
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "team_goals: head coach deletes" on public.team_goals
  for delete to authenticated using (public.can_write_team(team_id));

create policy "team_goal_updates: read" on public.team_goal_updates
  for select to authenticated using (public.can_read_team(team_id));

create policy "player_goals: read" on public.player_goals
  for select to authenticated using (public.can_read_team(team_id));
create policy "player_goals: head coach adds" on public.player_goals
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "player_goals: head coach updates" on public.player_goals
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "player_goals: head coach deletes" on public.player_goals
  for delete to authenticated using (public.can_write_team(team_id));

revoke execute on function public.after_team_goal_change() from anon, authenticated, public;
revoke execute on function public.before_player_goal_write() from anon, authenticated, public;
