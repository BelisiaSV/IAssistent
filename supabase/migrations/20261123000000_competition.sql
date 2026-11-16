-- Competition data from the weekly exports of Voetbal Vlaanderen (calendar and
-- results, standings, referee assignments). A platform admin links every team
-- to its team name and divisions in the export, and imports the files; only the
-- linked divisions are stored. The import also adds the matches of a team to
-- its week input and the scores to its match reports, without overwriting what
-- the head coach entered.

-- -----------------------------------------------------------------------------
-- Link of a team to the export
-- -----------------------------------------------------------------------------
alter table public.teams
  -- Team name as in the export, e.g. "Belisia Bilzen SV A"
  add column federation_team text check (federation_team is null or length(trim(federation_team)) between 1 and 120),
  -- Division codes of this team in the export, e.g. {1, BVVD}
  add column federation_divisions text[] not null default '{}' check (cardinality(federation_divisions) <= 10);

-- Only platform admins change the link (a head coach updates the other columns).
create function public.before_team_federation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.federation_team is distinct from old.federation_team or new.federation_divisions is distinct from old.federation_divisions)
     and auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'only a platform admin links a team to the competition' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger teams_before_federation_update before update on public.teams
  for each row execute function public.before_team_federation_update();

-- -----------------------------------------------------------------------------
-- Competition matches and standings (per division, not per team)
-- -----------------------------------------------------------------------------
create table public.competition_matches (
  id uuid primary key default gen_random_uuid(),
  division text not null check (length(division) between 1 and 20),
  match_date date not null,
  kickoff text check (kickoff is null or kickoff ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  home text not null check (length(home) between 1 and 120),
  away text not null check (length(away) between 1 and 120),
  home_goals smallint check (home_goals between 0 and 99),
  away_goals smallint check (away_goals between 0 and 99),
  -- Status code of the federation (e.g. PP, F1), null when normal
  status text check (status is null or length(status) <= 10),
  matchday smallint,
  home_club text check (home_club is null or length(home_club) <= 10),
  away_club text check (away_club is null or length(away_club) <= 10),
  referee text check (referee is null or length(referee) <= 120),
  assistant_1 text check (assistant_1 is null or length(assistant_1) <= 120),
  assistant_2 text check (assistant_2 is null or length(assistant_2) <= 120),
  fourth_official text check (fourth_official is null or length(fourth_official) <= 120),
  -- CHP (championship), CUP, FRG (friendly)
  match_type text check (match_type is null or length(match_type) <= 10),
  imported_at timestamptz not null default now(),
  unique (division, match_date, home, away)
);

create index competition_matches_home_idx on public.competition_matches (home, match_date);
create index competition_matches_away_idx on public.competition_matches (away, match_date);

create table public.competition_standings (
  division text not null check (length(division) between 1 and 20),
  -- 0 = whole season, 1..n = period
  period smallint not null default 0,
  position smallint not null,
  team text not null check (length(team) between 1 and 120),
  played smallint not null default 0,
  won smallint not null default 0,
  lost smallint not null default 0,
  drawn smallint not null default 0,
  goals_for smallint not null default 0,
  goals_against smallint not null default 0,
  points smallint not null default 0,
  imported_at timestamptz not null default now(),
  primary key (division, period, team)
);

-- Whoever can read a team linked to the division reads it.
create function public.can_read_division(p_division text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where p_division = any (t.federation_divisions) and public.can_read_team(t.id)
  ) or public.is_platform_admin();
$$;

alter table public.competition_matches enable row level security;
alter table public.competition_standings enable row level security;
revoke all on public.competition_matches, public.competition_standings from anon, public;
grant select on public.competition_matches, public.competition_standings to authenticated;

create policy "competition_matches: read" on public.competition_matches
  for select to authenticated using (public.can_read_division(division));
create policy "competition_standings: read" on public.competition_standings
  for select to authenticated using (public.can_read_division(division));

-- -----------------------------------------------------------------------------
-- Admin: teams with their link, setting the link, the import
-- -----------------------------------------------------------------------------
create function public.admin_competition_teams()
returns table (id uuid, name text, club_name text, archived boolean, federation_team text, federation_divisions text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query
    select t.id, t.name, t.club_name, t.archived_at is not null, t.federation_team, t.federation_divisions
    from public.teams t
    order by t.club_name, t.name;
end;
$$;

create function public.admin_set_team_competition(p_team uuid, p_federation_team text, p_divisions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  update public.teams
  set federation_team = nullif(trim(p_federation_team), ''),
      federation_divisions = coalesce(p_divisions, '{}')
  where id = p_team;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Imports the competition data of some divisions:
--   p_matches   [{ division, date, kickoff, home, away, home_goals, away_goals, status, matchday, home_club, away_club }]
--               (calendar and results: replaces all matches of the divisions in p_divisions)
--   p_standings [{ division, period, position, team, played, won, lost, drawn, goals_for, goals_against, points }]
--               (replaces the standings of the divisions that are in it)
--   p_referees  [{ division, date, kickoff, home, away, referee, assistant_1, assistant_2, fourth_official, match_type }]
--               (sets the referees of these matches; adds the match when it is missing)
-- Then adds the matches to the week input of the linked teams and the scores
-- to their match reports. Returns counts.
create function public.admin_import_competition(p_divisions text[], p_matches jsonb, p_standings jsonb, p_referees jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matches integer := 0;
  v_standings integer := 0;
  v_referees integer := 0;
  v_weeks integer := 0;
  v_reports integer := 0;
  v_team record;
  v_match record;
  v_week_start date;
  v_week public.week_plans%rowtype;
  v_entry jsonb;
  v_trainings jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;

  -- Calendar and results: the file holds the whole season of a division.
  if p_matches is not null and jsonb_array_length(p_matches) > 0 then
    delete from public.competition_matches m
    where m.division = any (p_divisions)
      and m.division in (select distinct x->>'division' from jsonb_array_elements(p_matches) x);
    insert into public.competition_matches
      (division, match_date, kickoff, home, away, home_goals, away_goals, status, matchday, home_club, away_club)
    select x->>'division', (x->>'date')::date, nullif(x->>'kickoff', ''), x->>'home', x->>'away',
           (x->>'home_goals')::smallint, (x->>'away_goals')::smallint, nullif(x->>'status', ''),
           (x->>'matchday')::smallint, nullif(x->>'home_club', ''), nullif(x->>'away_club', '')
    from jsonb_array_elements(p_matches) x
    where x->>'division' = any (p_divisions)
    on conflict (division, match_date, home, away) do update
      set kickoff = excluded.kickoff, home_goals = excluded.home_goals, away_goals = excluded.away_goals,
          status = excluded.status, matchday = excluded.matchday, imported_at = now();
    get diagnostics v_matches = row_count;
  end if;

  -- Standings: replace per division.
  if p_standings is not null and jsonb_array_length(p_standings) > 0 then
    delete from public.competition_standings s
    where s.division = any (p_divisions)
      and s.division in (select distinct x->>'division' from jsonb_array_elements(p_standings) x);
    insert into public.competition_standings
      (division, period, position, team, played, won, lost, drawn, goals_for, goals_against, points)
    select x->>'division', (x->>'period')::smallint, (x->>'position')::smallint, x->>'team',
           (x->>'played')::smallint, (x->>'won')::smallint, (x->>'lost')::smallint, (x->>'drawn')::smallint,
           (x->>'goals_for')::smallint, (x->>'goals_against')::smallint, (x->>'points')::smallint
    from jsonb_array_elements(p_standings) x
    where x->>'division' = any (p_divisions)
    on conflict (division, period, team) do nothing;
    get diagnostics v_standings = row_count;
  end if;

  -- Referees of the coming matches.
  if p_referees is not null and jsonb_array_length(p_referees) > 0 then
    insert into public.competition_matches
      (division, match_date, kickoff, home, away, referee, assistant_1, assistant_2, fourth_official, match_type)
    select x->>'division', (x->>'date')::date, nullif(x->>'kickoff', ''), x->>'home', x->>'away',
           nullif(x->>'referee', ''), nullif(x->>'assistant_1', ''), nullif(x->>'assistant_2', ''),
           nullif(x->>'fourth_official', ''), nullif(x->>'match_type', '')
    from jsonb_array_elements(p_referees) x
    where x->>'division' = any (p_divisions)
    on conflict (division, match_date, home, away) do update
      set referee = excluded.referee, assistant_1 = excluded.assistant_1, assistant_2 = excluded.assistant_2,
          fourth_official = excluded.fourth_official, match_type = excluded.match_type,
          kickoff = coalesce(excluded.kickoff, public.competition_matches.kickoff), imported_at = now();
    get diagnostics v_referees = row_count;
  end if;

  -- Week input and match reports of the linked teams.
  for v_team in
    select t.id, t.federation_team, t.federation_divisions, t.training_schedule
    from public.teams t
    where t.federation_team is not null and t.archived_at is null and t.federation_divisions && p_divisions
  loop
    for v_match in
      select m.*, (m.home = v_team.federation_team) as is_home
      from public.competition_matches m
      where m.division = any (v_team.federation_divisions)
        and (m.home = v_team.federation_team or m.away = v_team.federation_team)
        and coalesce(m.status, '') not in ('PP')
      order by m.match_date
    loop
      v_entry := jsonb_build_object(
        'date', v_match.match_date,
        'start', v_match.kickoff,
        'opponent', case when v_match.is_home then v_match.away else v_match.home end,
        'home', v_match.is_home
      );
      v_week_start := v_match.match_date - (extract(isodow from v_match.match_date)::integer - 1);

      -- Week input: only weeks from this week on; never change what is there.
      if v_week_start >= (current_date - (extract(isodow from current_date)::integer - 1)) then
        select * into v_week from public.week_plans w where w.team_id = v_team.id and w.week_start = v_week_start;
        if not found then
          -- New week: the fixed training days, without a training on the match day.
          select coalesce(jsonb_agg(jsonb_build_object(
                   'date', v_week_start + ((s->>'weekday')::integer - 1),
                   'start', s->>'start',
                   'duration_min', (s->>'duration_min')::integer)
                 ) filter (where v_week_start + ((s->>'weekday')::integer - 1) <> v_match.match_date), '[]'::jsonb)
            into v_trainings
          from jsonb_array_elements(coalesce(v_team.training_schedule, '[]'::jsonb)) s;
          insert into public.week_plans (team_id, week_start, trainings, matches, previous_match_date, created_by)
          values (
            v_team.id, v_week_start, v_trainings, jsonb_build_array(v_entry),
            (select max(p.match_date) from public.competition_matches p
             where p.division = any (v_team.federation_divisions)
               and (p.home = v_team.federation_team or p.away = v_team.federation_team)
               and p.match_date < v_week_start),
            null
          );
          v_weeks := v_weeks + 1;
        elsif not exists (select 1 from jsonb_array_elements(v_week.matches) x where (x->>'date')::date = v_match.match_date)
              and not exists (select 1 from jsonb_array_elements(v_week.trainings) x where (x->>'date')::date = v_match.match_date)
              and jsonb_array_length(v_week.matches) < 3 then
          update public.week_plans set matches = matches || jsonb_build_array(v_entry) where id = v_week.id;
          v_weeks := v_weeks + 1;
        end if;
      end if;

      -- Match reports: the score of a played match, never overwriting the coach's.
      if v_match.home_goals is not null and v_match.away_goals is not null and v_match.match_date <= current_date then
        insert into public.match_reports (team_id, match_date, opponent_name, home, goals_for, goals_against, created_by)
        values (
          v_team.id, v_match.match_date, v_entry->>'opponent', v_match.is_home,
          case when v_match.is_home then v_match.home_goals else v_match.away_goals end,
          case when v_match.is_home then v_match.away_goals else v_match.home_goals end,
          null
        )
        on conflict (team_id, match_date) do update
          set goals_for = coalesce(public.match_reports.goals_for, excluded.goals_for),
              goals_against = coalesce(public.match_reports.goals_against, excluded.goals_against)
          where public.match_reports.goals_for is null or public.match_reports.goals_against is null;
        if found then v_reports := v_reports + 1; end if;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('matches', v_matches, 'standings', v_standings, 'referees', v_referees, 'weeks', v_weeks, 'reports', v_reports);
end;
$$;

revoke execute on function public.before_team_federation_update() from anon, public;
revoke execute on function public.can_read_division(text) from anon, public;
revoke execute on function public.admin_competition_teams() from anon, public;
revoke execute on function public.admin_set_team_competition(uuid, text, text[]) from anon, public;
revoke execute on function public.admin_import_competition(text[], jsonb, jsonb, jsonb) from anon, public;
grant execute on function public.can_read_division(text) to authenticated;
grant execute on function public.admin_competition_teams() to authenticated;
grant execute on function public.admin_set_team_competition(uuid, text, text[]) to authenticated;
grant execute on function public.admin_import_competition(text[], jsonb, jsonb, jsonb) to authenticated;
