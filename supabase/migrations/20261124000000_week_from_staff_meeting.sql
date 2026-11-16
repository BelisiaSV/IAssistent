-- The head coach can put the week plan of an approved staff meeting in the
-- microcycle: it becomes an approved version of the week document (a run with
-- one Assistant Coach step). Such a run has provider 'staffkamer' and refers to
-- the meeting; it is no AI request, so it does not count for the daily limit.

alter table public.staff_runs drop constraint staff_runs_provider_check;
alter table public.staff_runs
  add constraint staff_runs_provider_check check (provider in ('example', 'anthropic', 'staffkamer')),
  add column meeting_id uuid references public.staff_meetings (id) on delete set null;

alter table public.staff_proposals drop constraint staff_proposals_provider_check;
alter table public.staff_proposals
  add constraint staff_proposals_provider_check check (provider in ('example', 'anthropic', 'staffkamer'));

-- Same as before, but only real AI requests count for the daily limit.
create or replace function public.before_staff_run_insert()
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

  if new.meeting_id is not null and not exists (
    select 1 from public.staff_meetings m where m.id = new.meeting_id and m.team_id = new.team_id
  ) then
    raise exception 'meeting does not belong to the team' using errcode = 'check_violation';
  end if;

  if new.provider = 'anthropic' and (
    select count(*) from public.staff_runs r
    where r.created_by = new.created_by and r.provider = 'anthropic' and r.created_at >= v_today_start
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
