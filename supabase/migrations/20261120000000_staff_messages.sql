-- Conversations of the head coach with the roles of the staff (Staff Room).
-- Every role has its own history per team; the messages stay readable for
-- whoever can read the team (also when it is archived). Messages are never
-- changed or deleted.

create table public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- Role id from /staff (e.g. assistant-coach, coordinator)
  role text not null check (role ~ '^[a-z][a-z0-9-]{1,40}$'),
  author text not null check (author in ('coach', 'role')),
  content text not null check (length(trim(content)) between 1 and 4000),
  -- A joint task the role proposes: { titel, betrokken_rollen, opdracht } or null
  task_proposal jsonb check (task_proposal is null or jsonb_typeof(task_proposal) = 'object'),
  -- Who answered for a role message: 'example' (test mode) or the AI provider
  provider text check (provider is null or length(provider) <= 40),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now()
);

create index staff_messages_thread_idx on public.staff_messages (team_id, role, created_at);
create index staff_messages_created_by_idx on public.staff_messages (created_by, created_at);

-- Maximum AI answers in conversations per coach per day (test mode does not count).
create function public.staff_chat_daily_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30 $$;

create function public.before_staff_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
begin
  if new.author = 'role' and coalesce(new.provider, '') <> 'example' and (
    select count(*) from public.staff_messages m
    where m.created_by = new.created_by and m.author = 'role'
      and coalesce(m.provider, '') <> 'example' and m.created_at >= v_today_start
  ) >= public.staff_chat_daily_limit() then
    raise exception 'daily limit of staff messages reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;
  return new;
end;
$$;

create trigger staff_messages_before_insert
  before insert on public.staff_messages
  for each row execute function public.before_staff_message_insert();

alter table public.staff_messages enable row level security;
revoke all on public.staff_messages from anon, public;
grant select, insert on public.staff_messages to authenticated;
revoke execute on function public.staff_chat_daily_limit() from anon, public;
revoke execute on function public.before_staff_message_insert() from anon, public;
grant execute on function public.staff_chat_daily_limit() to authenticated;

create policy "staff_messages: read" on public.staff_messages
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_messages: head coach writes" on public.staff_messages
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = auth.uid());
