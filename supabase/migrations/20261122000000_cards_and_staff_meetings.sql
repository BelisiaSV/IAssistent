-- 1. Yellow and red cards per player per match, and the suspension rules of a
--    team (set by the head coach), so the Team Manager can report suspensions.
-- 2. The staff meeting in the Staff Room: the head coach gives one assignment,
--    the roles speak in turn in a group chat and one role writes the joint
--    overview, which the head coach approves or asks to adjust (new version).

-- -----------------------------------------------------------------------------
-- Suspension rules of a team
-- -----------------------------------------------------------------------------
alter table public.teams
  -- Every n-th yellow card of the season gives a suspension
  add column yellow_card_limit integer not null default 5 check (yellow_card_limit between 1 and 20),
  -- Matches suspended for that yellow card
  add column yellow_card_ban integer not null default 1 check (yellow_card_ban between 0 and 10),
  -- Matches suspended for a red card
  add column red_card_ban integer not null default 1 check (red_card_ban between 0 and 20);

-- -----------------------------------------------------------------------------
-- Cards
-- -----------------------------------------------------------------------------
create table public.player_cards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  match_date date not null,
  card text not null check (card in ('yellow', 'red')),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now()
);

create index player_cards_team_idx on public.player_cards (team_id, match_date);

create function public.check_player_card_team()
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

create trigger player_cards_check_team before insert or update on public.player_cards
  for each row execute function public.check_player_card_team();

alter table public.player_cards enable row level security;
revoke all on public.player_cards from anon, public;
grant select, insert, delete on public.player_cards to authenticated;
revoke execute on function public.check_player_card_team() from anon, public;

create policy "player_cards: read" on public.player_cards
  for select to authenticated using (public.can_read_team(team_id));
create policy "player_cards: head coach inserts" on public.player_cards
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "player_cards: head coach deletes" on public.player_cards
  for delete to authenticated using (public.can_write_team(team_id));

-- -----------------------------------------------------------------------------
-- Staff meetings
-- -----------------------------------------------------------------------------
create table public.staff_meetings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- The assignment of the head coach, in his words
  assignment text not null check (length(trim(assignment)) between 1 and 2000),
  status text not null default 'running' check (status in ('running', 'ready', 'failed', 'approved')),
  version integer not null default 1 check (version >= 1),
  -- What the head coach asked to change, one entry per later version (version n = feedbacks[n - 1])
  feedbacks text[] not null default '{}' check (cardinality(feedbacks) <= 50),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create index staff_meetings_team_idx on public.staff_meetings (team_id, created_at desc);

create trigger staff_meetings_set_updated_at before update on public.staff_meetings
  for each row execute function public.set_updated_at();

create table public.staff_meeting_turns (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.staff_meetings (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  version integer not null check (version >= 1),
  position integer not null check (position >= 1),
  role text not null check (role ~ '^[a-z][a-z0-9-]{1,40}$'),
  -- Kind of turn from _gedeeld/staffkamer.json
  kind text not null check (kind in ('opening', 'bijdrage', 'reactie', 'overzicht')),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  -- { bericht, aan, overzicht } (output-schema of taken/staffkamer)
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  -- 'example' (test mode) or the AI provider
  provider text not null check (length(provider) between 1 and 40),
  created_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, version, position)
);

create index staff_meeting_turns_created_by_idx on public.staff_meeting_turns (created_by, created_at);

create trigger staff_meeting_turns_set_updated_at before update on public.staff_meeting_turns
  for each row execute function public.set_updated_at();

-- Maximum AI turns in staff meetings per coach per day (test mode does not count).
create function public.staff_meeting_daily_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 80 $$;

create function public.before_staff_meeting_turn_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
begin
  if not exists (select 1 from public.staff_meetings m where m.id = new.meeting_id and m.team_id = new.team_id) then
    raise exception 'turn does not belong to a meeting of this team' using errcode = 'check_violation';
  end if;
  if new.provider <> 'example' and (
    select count(*) from public.staff_meeting_turns t
    where t.created_by = new.created_by and t.provider <> 'example' and t.created_at >= v_today_start
  ) >= public.staff_meeting_daily_limit() then
    raise exception 'daily limit of staff meeting turns reached'
      using errcode = 'check_violation', hint = 'daily_limit_reached';
  end if;
  return new;
end;
$$;

create trigger staff_meeting_turns_before_insert
  before insert on public.staff_meeting_turns
  for each row execute function public.before_staff_meeting_turn_insert();

alter table public.staff_meetings enable row level security;
alter table public.staff_meeting_turns enable row level security;
revoke all on public.staff_meetings, public.staff_meeting_turns from anon, public;
grant select, insert, update on public.staff_meetings, public.staff_meeting_turns to authenticated;
revoke execute on function public.staff_meeting_daily_limit() from anon, public;
revoke execute on function public.before_staff_meeting_turn_insert() from anon, public;
grant execute on function public.staff_meeting_daily_limit() to authenticated;

create policy "staff_meetings: read" on public.staff_meetings
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_meetings: head coach starts" on public.staff_meetings
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = auth.uid());
create policy "staff_meetings: head coach updates" on public.staff_meetings
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));

create policy "staff_meeting_turns: read" on public.staff_meeting_turns
  for select to authenticated using (public.can_read_team(team_id));
create policy "staff_meeting_turns: head coach inserts" on public.staff_meeting_turns
  for insert to authenticated with check (public.can_write_team(team_id) and created_by = auth.uid());
create policy "staff_meeting_turns: head coach updates" on public.staff_meeting_turns
  for update to authenticated using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
