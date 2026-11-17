-- To-dos of the head coach on the Taken page (e.g. "Maak een individuele
-- videoanalyse van #7"). He ticks them off, or asks a role of the staff
-- ("Vraag aan de staf"): the task then goes to that role as a question.

create table public.coach_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  done boolean not null default false,
  done_at timestamptz,
  -- The role the task was asked to, and when
  role text check (role is null or role ~ '^[a-z][a-z0-9-]{1,40}$'),
  asked_at timestamptz,
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_tasks_team_idx on public.coach_tasks (team_id, done, created_at desc);

create trigger coach_tasks_set_updated_at before update on public.coach_tasks
  for each row execute function public.set_updated_at();

alter table public.coach_tasks enable row level security;
revoke all on public.coach_tasks from anon, public;
grant select, insert, update, delete on public.coach_tasks to authenticated;

create policy "coach_tasks: read" on public.coach_tasks
  for select to authenticated using (public.can_read_team(team_id));
create policy "coach_tasks: head coach adds" on public.coach_tasks
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "coach_tasks: head coach updates" on public.coach_tasks
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "coach_tasks: head coach deletes" on public.coach_tasks
  for delete to authenticated using (public.can_write_team(team_id));
