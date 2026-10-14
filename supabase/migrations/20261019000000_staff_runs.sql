-- =============================================================================
-- Stafmeeting: the head coach asks once; all roles work in order.
-- A run groups the proposals of one request: the week document (kind 'week')
-- or the match preparation (kind 'match'). The head coach approves a run as a
-- whole. The daily AI limit now counts runs, not single role outputs.
-- =============================================================================

alter type public.proposal_status add value if not exists 'pending' before 'generating';

create table public.staff_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  week_plan_id uuid not null references public.week_plans (id) on delete cascade,
  kind text not null check (kind in ('week', 'match')),
  version integer not null default 0,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed', 'approved', 'rejected')),
  -- Feedback of the head coach that this version answers, and the step it was
  -- meant for (null = the whole staff).
  feedback text check (feedback is null or length(feedback) <= 2000),
  feedback_step text check (feedback_step is null or feedback_step ~ '^[a-z]+$'),
  -- The run this version adjusts (its untouched steps are copied).
  based_on uuid references public.staff_runs (id) on delete set null,
  -- 'example' (test mode, no AI) or 'anthropic'
  provider text not null check (provider in ('example', 'anthropic')),
  created_by uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (week_plan_id, kind, version)
);

create index staff_runs_created_by_idx on public.staff_runs (created_by, created_at);

alter table public.staff_proposals
  add column run_id uuid references public.staff_runs (id) on delete cascade,
  -- Step key within the run (e.g. 'pc', 'tc', 'ac', 'tco', 'match')
  add column step text check (step is null or step ~ '^[a-z]+$');
create index staff_proposals_run_idx on public.staff_proposals (run_id);

-- Version per week and kind, week belongs to the team, daily AI limit per coach.
create function public.before_staff_run_insert()
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
    select count(*) from public.staff_runs r
    where r.created_by = new.created_by and r.provider <> 'example' and r.created_at >= v_today_start
  ) >= public.staff_daily_limit() then
    raise exception 'daily limit of staff requests reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.week_plan_id::text || 'run' || new.kind));
  select coalesce(max(version), 0) + 1 into new.version
  from public.staff_runs
  where week_plan_id = new.week_plan_id and kind = new.kind;

  return new;
end;
$$;

create trigger staff_runs_before_insert
  before insert on public.staff_runs
  for each row execute function public.before_staff_run_insert();

-- Proposals: version per week, role and task; the run must belong to the same
-- week. The daily limit moved to staff_runs.
create or replace function public.before_staff_proposal_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.week_plans w where w.id = new.week_plan_id and w.team_id = new.team_id
  ) then
    raise exception 'week plan does not belong to the team' using errcode = 'check_violation';
  end if;

  if new.run_id is not null and not exists (
    select 1 from public.staff_runs r where r.id = new.run_id and r.week_plan_id = new.week_plan_id
  ) then
    raise exception 'run does not belong to the week' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.week_plan_id::text || new.role || new.task));
  select coalesce(max(version), 0) + 1 into new.version
  from public.staff_proposals
  where week_plan_id = new.week_plan_id and role = new.role and task = new.task;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.staff_runs enable row level security;
revoke all on public.staff_runs from anon;
revoke execute on function public.before_staff_run_insert() from anon, public;

create policy "staff_runs: read" on public.staff_runs
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_runs: head coach requests" on public.staff_runs
  for insert to authenticated
  with check (public.can_write_team(team_id) and created_by = (select auth.uid()));
create policy "staff_runs: head coach updates" on public.staff_runs
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
-- Runs are never deleted by users; only their status and decision change.
revoke delete on public.staff_runs from authenticated;
revoke update on public.staff_runs from authenticated;
grant update (status, decided_at) on public.staff_runs to authenticated;
