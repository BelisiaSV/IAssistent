-- =============================================================================
-- Fase 2a: spelersbeheer + wedstrijdselecties (opstelling via formatie)
--
-- Positie- en formatiecodes komen uit /staff/_gedeeld (posities.json,
-- formaties.json). De database bewaart alleen de codes; de app controleert
-- ze tegen de inhoud van /staff.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Players: extra fields
-- -----------------------------------------------------------------------------
create type public.preferred_foot as enum ('left', 'right', 'both');

alter table public.players rename column position to primary_position;

-- Free-text positions from phase 1 -> position codes where they are recognisable.
update public.players set primary_position = case lower(trim(primary_position))
    when 'doelman' then 'GK'
    when 'keeper' then 'GK'
    when 'verdediger' then 'CB'
    when 'middenvelder' then 'CM'
    when 'aanvaller' then 'ST'
    when 'spits' then 'ST'
    else null
  end
where primary_position is not null and primary_position !~ '^[A-Z][A-Z0-9]{0,5}$';

alter table public.players
  drop constraint if exists players_position_check,
  add constraint players_primary_position_check
    check (primary_position is null or primary_position ~ '^[A-Z][A-Z0-9]{0,5}$'),
  add column secondary_positions text[] not null default '{}'
    check (array_length(secondary_positions, 1) is null or array_length(secondary_positions, 1) <= 6),
  add column preferred_foot public.preferred_foot,
  -- Season start year when the player joined the club (2019 = season 2019-2020).
  add column joined_club_year smallint check (joined_club_year between 1950 and 2100),
  -- Only meaningful while status = 'injured'. No medical details are stored (GDPR art. 9).
  add column expected_return_date date,
  -- Player left the squad. Kept for history (old selections), hidden from the active squad.
  add column archived_at timestamptz;

alter table public.players
  add constraint players_notes_length check (notes is null or length(notes) <= 500);

create unique index players_team_shirt_number_unique
  on public.players (team_id, shirt_number)
  where shirt_number is not null and archived_at is null;

-- -----------------------------------------------------------------------------
-- Lineups: a match selection drawn on a formation
-- -----------------------------------------------------------------------------
create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  match_date date,
  opponent text check (opponent is null or length(opponent) <= 120),
  -- Formation code from /staff/_gedeeld/formaties.json
  formation text not null check (length(formation) between 1 and 20),
  -- { "<slot id>": "<player uuid>" }
  starters jsonb not null default '{}'::jsonb check (jsonb_typeof(starters) = 'object'),
  bench uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lineups_team_id_idx on public.lineups (team_id, match_date desc);

create trigger lineups_set_updated_at before update on public.lineups
  for each row execute function public.set_updated_at();

-- Every player in a lineup belongs to the lineup's team, and appears only once.
create function public.check_lineup_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if exists (
    select 1 from jsonb_each(new.starters) s
    where jsonb_typeof(s.value) <> 'string'
       or s.value #>> '{}' !~ '^[0-9a-fA-F-]{36}$'
  ) then
    raise exception 'lineup starters must map slot ids to player ids'
      using errcode = 'check_violation';
  end if;

  select array_agg(x) into v_ids from (
    select (s.value #>> '{}')::uuid as x from jsonb_each(new.starters) s
    union all
    select unnest(new.bench)
  ) ids;

  if v_ids is null then
    return new;
  end if;

  if (select count(*) from unnest(v_ids)) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'a player can only appear once in a lineup'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from public.players p where p.id = x and p.team_id = new.team_id)
  ) then
    raise exception 'lineup contains players of another team'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger lineups_check_players
  before insert or update on public.lineups
  for each row execute function public.check_lineup_players();

alter table public.lineups enable row level security;
revoke all on public.lineups from anon;

create policy "lineups: read" on public.lineups
  for select to authenticated using (public.can_read_team(team_id));
create policy "lineups: head coach inserts" on public.lineups
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "lineups: head coach updates" on public.lineups
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "lineups: head coach deletes" on public.lineups
  for delete to authenticated using (public.can_write_team(team_id));

revoke execute on function public.check_lineup_players() from anon, public;
