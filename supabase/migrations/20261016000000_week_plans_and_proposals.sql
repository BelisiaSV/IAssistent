-- =============================================================================
-- Fase 3a: weekinput en voorstellen van de AI-staf (eerste rol: Assistent Coach)
-- =============================================================================

-- Standard training schedule of a team: [{ "weekday": 1-7 (ISO, 1 = maandag),
-- "start": "HH:MM", "duration_min": 30-240 }]. Can be changed per week.
alter table public.teams
  add column training_schedule jsonb not null default '[]'::jsonb
    check (jsonb_typeof(training_schedule) = 'array' and jsonb_array_length(training_schedule) <= 7);

-- -----------------------------------------------------------------------------
-- Week input from the head coach
-- -----------------------------------------------------------------------------
create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- Monday of the week
  week_start date not null check (extract(isodow from week_start) = 1),
  -- [{ "date": "YYYY-MM-DD", "start": "HH:MM", "duration_min": n }]
  trainings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(trainings) = 'array' and jsonb_array_length(trainings) <= 7),
  -- [{ "date": "YYYY-MM-DD", "start": "HH:MM" | null, "opponent": "...", "home": bool }]
  matches jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matches) = 'array' and jsonb_array_length(matches) <= 3),
  previous_match_date date,
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, week_start)
);

create trigger week_plans_set_updated_at before update on public.week_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Proposals of a staff role for a week (every version is kept)
-- -----------------------------------------------------------------------------
create type public.proposal_status as enum ('generating', 'ready', 'failed', 'approved', 'rejected');

create table public.staff_proposals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  week_plan_id uuid not null references public.week_plans (id) on delete cascade,
  -- Role id from /staff (e.g. assistant-coach)
  role text not null check (role ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  version integer not null default 0,
  status public.proposal_status not null default 'generating',
  -- Feedback of the head coach that this version answers
  feedback text check (feedback is null or length(feedback) <= 2000),
  output jsonb,
  error text,
  -- 'example' (test mode, no AI) or 'anthropic'
  provider text not null check (provider in ('example', 'anthropic')),
  model text,
  usage jsonb,
  -- Version of the role content in /staff that produced the output
  content_version text,
  created_by uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (week_plan_id, role, version)
);

create index staff_proposals_week_idx on public.staff_proposals (week_plan_id, role, version desc);
create index staff_proposals_created_by_idx on public.staff_proposals (created_by, created_at);

-- Maximum AI proposals per coach per day (test mode does not count).
create function public.staff_daily_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- Assigns the next version number, checks the week belongs to the team and
-- enforces the daily AI limit.
create function public.before_staff_proposal_insert()
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

  -- Serialise version numbers per week and role.
  perform pg_advisory_xact_lock(hashtext(new.week_plan_id::text || new.role));
  select coalesce(max(version), 0) + 1 into new.version
  from public.staff_proposals
  where week_plan_id = new.week_plan_id and role = new.role;

  return new;
end;
$$;

create trigger staff_proposals_before_insert
  before insert on public.staff_proposals
  for each row execute function public.before_staff_proposal_insert();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.week_plans enable row level security;
alter table public.staff_proposals enable row level security;
revoke all on public.week_plans, public.staff_proposals from anon;
revoke execute on function public.staff_daily_limit() from anon, public;
revoke execute on function public.before_staff_proposal_insert() from anon, public;
grant execute on function public.staff_daily_limit() to authenticated;

create policy "week_plans: read" on public.week_plans
  for select to authenticated using (public.can_read_team(team_id));
create policy "week_plans: head coach inserts" on public.week_plans
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "week_plans: head coach updates" on public.week_plans
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "week_plans: head coach deletes" on public.week_plans
  for delete to authenticated using (public.can_write_team(team_id));

create policy "staff_proposals: read" on public.staff_proposals
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_proposals: head coach requests" on public.staff_proposals
  for insert to authenticated
  with check (public.can_write_team(team_id) and created_by = (select auth.uid()));
create policy "staff_proposals: head coach updates" on public.staff_proposals
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
-- Proposals are never deleted by users (history of what the staff proposed).
revoke delete on public.staff_proposals from authenticated;
revoke update on public.staff_proposals from authenticated;
grant update (status, output, error, model, usage, content_version, decided_at)
  on public.staff_proposals to authenticated;
