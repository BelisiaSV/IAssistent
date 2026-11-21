-- =============================================================================
-- Training Quality Engine: a quality check of every week proposal of the staff.
--
-- A role of the staff (kwaliteit.json in /staff) scores the proposal against
-- the criteria in /staff (assignment, learning goal, club principles, level,
-- load, methodical build-up) with improvement points. Every check is kept per
-- run: the head coach sees it before approving, the club (owner, admin,
-- technical director via can_read_team) sees the check of the approved version.
-- Rows are never changed or deleted by users.
-- =============================================================================

create table public.training_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  run_id uuid not null references public.staff_runs (id) on delete cascade,
  status text not null check (status in ('ready', 'failed')),
  -- { samenvatting, criteria: [{ code, score, toelichting }], sterke_punten, verbeterpunten: [{ criterium, punt }] }
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  average numeric(3, 1) check (average is null or average between 0 and 10),
  verdict text check (verdict is null or verdict ~ '^[a-z][a-z_]*$'),
  provider text not null check (length(provider) between 1 and 40),
  model text,
  usage jsonb,
  content_version text,
  error text check (error is null or length(error) <= 2000),
  created_by uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((status = 'ready') = (output is not null and average is not null and verdict is not null))
);

create index training_quality_reviews_run_idx on public.training_quality_reviews (run_id, created_at desc);
create index training_quality_reviews_team_idx on public.training_quality_reviews (team_id, created_at desc);

-- Maximum quality checks with real AI per coach per day (test mode does not count).
create function public.staff_quality_daily_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- Quality checks with real AI the current coach still has today.
create function public.staff_quality_remaining_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, public.staff_quality_daily_limit() - (
    select count(*)::integer from public.training_quality_reviews q
    where q.created_by = (select auth.uid()) and q.provider <> 'example'
      and q.created_at >= date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'
  ));
$$;

-- The run belongs to the same team; the daily limit holds.
create function public.before_training_quality_review_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
begin
  if not exists (
    select 1 from public.staff_runs r where r.id = new.run_id and r.team_id = new.team_id and r.kind = 'week'
  ) then
    raise exception 'run is not a week run of this team' using errcode = 'check_violation';
  end if;
  if new.provider <> 'example' and (
    select count(*) from public.training_quality_reviews q
    where q.created_by = new.created_by and q.provider <> 'example' and q.created_at >= v_today_start
  ) >= public.staff_quality_daily_limit() then
    raise exception 'daily limit of quality checks reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;
  return new;
end;
$$;

create trigger training_quality_reviews_before_insert
  before insert on public.training_quality_reviews
  for each row execute function public.before_training_quality_review_insert();

alter table public.training_quality_reviews enable row level security;
revoke all on public.training_quality_reviews from anon, authenticated, public;
grant select, insert on public.training_quality_reviews to authenticated;

create policy "training_quality_reviews: read" on public.training_quality_reviews
  for select to authenticated using (public.can_read_team(team_id));
create policy "training_quality_reviews: head coach writes" on public.training_quality_reviews
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = (select auth.uid()));

revoke execute on function public.staff_quality_daily_limit() from anon, public;
revoke execute on function public.before_training_quality_review_insert() from anon, authenticated, public;
revoke execute on function public.staff_quality_remaining_today() from anon, public;
grant execute on function public.staff_quality_daily_limit() to authenticated;
grant execute on function public.staff_quality_remaining_today() to authenticated;
