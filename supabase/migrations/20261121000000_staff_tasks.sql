-- Joint tasks of the staff. A role proposes a task in the Staff Room
-- (staff_messages.task_proposal); when the head coach confirms it, the task
-- runs in steps: a contribution of every involved role, then the final
-- proposal of the role that proposed it. The head coach approves the final
-- proposal or asks for an adjustment (a new version; earlier steps are kept).

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- The message with the proposal; a proposal is confirmed at most once.
  source_message_id uuid not null unique references public.staff_messages (id) on delete cascade,
  -- Role that proposed the task and makes the final proposal (id in /staff)
  owner_role text not null check (owner_role ~ '^[a-z][a-z0-9-]{1,40}$'),
  -- Roles that contribute, in order
  roles text[] not null check (cardinality(roles) between 1 and 6),
  title text not null check (length(trim(title)) between 1 and 120),
  assignment text not null check (length(trim(assignment)) between 1 and 2000),
  status text not null default 'running' check (status in ('running', 'ready', 'failed', 'approved')),
  version integer not null default 1 check (version >= 1),
  -- What the head coach wants changed in the current version (null for version 1)
  feedback text check (feedback is null or length(feedback) <= 2000),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create index staff_tasks_team_idx on public.staff_tasks (team_id, created_at desc);

create trigger staff_tasks_set_updated_at before update on public.staff_tasks
  for each row execute function public.set_updated_at();

create table public.staff_task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  version integer not null check (version >= 1),
  position integer not null check (position >= 1),
  role text not null check (role ~ '^[a-z][a-z0-9-]{1,40}$'),
  phase text not null check (phase in ('bijdrage', 'eindvoorstel')),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  -- { samenvatting, inhoud, aandachtspunten } (output-schema of taken/samenwerking)
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  -- 'example' (test mode) or the AI provider
  provider text not null check (length(provider) between 1 and 40),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, version, position)
);

create index staff_task_steps_created_by_idx on public.staff_task_steps (created_by, created_at);

create trigger staff_task_steps_set_updated_at before update on public.staff_task_steps
  for each row execute function public.set_updated_at();

-- Maximum AI steps of joint tasks per coach per day (test mode does not count).
create function public.staff_task_daily_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- A task comes from a proposal of a role of the same team.
create function public.before_staff_task_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff_messages m
    where m.id = new.source_message_id and m.team_id = new.team_id
      and m.author = 'role' and m.role = new.owner_role and m.task_proposal is not null
  ) then
    raise exception 'task does not come from a proposal of this team' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger staff_tasks_before_insert
  before insert on public.staff_tasks
  for each row execute function public.before_staff_task_insert();

-- A step belongs to a task of the same team; real AI steps have a daily limit.
create function public.before_staff_task_step_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
begin
  if not exists (select 1 from public.staff_tasks t where t.id = new.task_id and t.team_id = new.team_id) then
    raise exception 'step does not belong to a task of this team' using errcode = 'check_violation';
  end if;
  if new.provider <> 'example' and (
    select count(*) from public.staff_task_steps s
    where s.created_by = new.created_by and s.provider <> 'example' and s.created_at >= v_today_start
  ) >= public.staff_task_daily_limit() then
    raise exception 'daily limit of staff task steps reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;
  return new;
end;
$$;

create trigger staff_task_steps_before_insert
  before insert on public.staff_task_steps
  for each row execute function public.before_staff_task_step_insert();

alter table public.staff_tasks enable row level security;
alter table public.staff_task_steps enable row level security;
revoke all on public.staff_tasks, public.staff_task_steps from anon, public;
grant select, insert, update on public.staff_tasks, public.staff_task_steps to authenticated;
revoke execute on function public.staff_task_daily_limit() from anon, public;
revoke execute on function public.before_staff_task_insert() from anon, public;
revoke execute on function public.before_staff_task_step_insert() from anon, public;
grant execute on function public.staff_task_daily_limit() to authenticated;

create policy "staff_tasks: read" on public.staff_tasks
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_tasks: head coach confirms" on public.staff_tasks
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = auth.uid());
create policy "staff_tasks: head coach updates" on public.staff_tasks
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));

create policy "staff_task_steps: read" on public.staff_task_steps
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_task_steps: head coach inserts" on public.staff_task_steps
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = auth.uid());
create policy "staff_task_steps: head coach updates" on public.staff_task_steps
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
