-- =============================================================================
-- Competition ready at once for a team of a club.
--
--   * The admin import also keeps the divisions of every team of the clubs on
--     the platform (chosen in the browser), so the data is there before a
--     trainer links his team.
--   * A coach who asks to bring his team into a club picks its team in the
--     federation export (club_federation_teams). On approval the team is
--     linked to that team and its divisions.
--   * Whenever a team is linked to the competition (by the admin, the club
--     Excel or an approved request), the stored matches go straight into its
--     week input and the scores into its match reports (sync_team_competition).
-- =============================================================================

-- The teams of a club in the federation export, for its members.
create function public.club_federation_teams(p_club_id uuid)
returns table (name text, divisions text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_club_member(p_club_id) or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select x->>'name', array(select jsonb_array_elements_text(coalesce(x->'divisions', '[]'::jsonb)))
    from public.clubs c
    join public.federation_clubs f on f.number = c.federation_number
    cross join lateral jsonb_array_elements(f.teams) x
    where c.id = p_club_id
    order by x->>'name';
end;
$$;

-- The team in the export that a request brings along.
alter table public.club_team_links
  add column federation_team text check (federation_team is null or length(trim(federation_team)) between 1 and 120);

drop function public.request_club_team_link(uuid, uuid);
create function public.request_club_team_link(p_team_id uuid, p_club_id uuid, p_federation_team text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_federation text := nullif(trim(p_federation_team), '');
begin
  if not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.club_id is null and t.archived_at is null
      and t.head_coach_id = (select auth.uid())
  ) then
    raise exception 'only the coach of an active personal team can link it' using errcode = '42501';
  end if;
  if not public.has_club_role(p_club_id, '{coach,assistant_coach}') then
    raise exception 'not a coach of this club' using errcode = '42501';
  end if;
  if v_federation is not null
     and not exists (select 1 from public.club_federation_teams(p_club_id) f where f.name = v_federation) then
    raise exception 'not a team of this club in the export' using errcode = 'check_violation';
  end if;
  insert into public.club_team_links (club_id, team_id, requested_by, federation_team)
  values (p_club_id, p_team_id, (select auth.uid()), v_federation)
  returning id into v_id;
  perform public.club_audit(p_club_id, 'team_link.requested', (select auth.uid()), p_team_id,
    jsonb_build_object('federation_team', v_federation));
  return v_id;
end;
$$;

-- Only platform admins change the link by hand; an approved club request
-- sets it through a flag (as the club itself).
create or replace function public.before_team_federation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.federation_team is distinct from old.federation_team or new.federation_divisions is distinct from old.federation_divisions)
     and auth.uid() is not null and not public.is_platform_admin()
     and coalesce(current_setting('iassistent.federation_link', true), '') <> new.id::text then
    raise exception 'only a platform admin links a team to the competition' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- An approved request links the team to the chosen team in the export.
create function public.after_club_team_link_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_divisions text[];
begin
  if new.federation_team is null then
    return new;
  end if;
  select f.divisions into v_divisions
  from public.club_federation_teams(new.club_id) f where f.name = new.federation_team;
  if v_divisions is null then
    return new;
  end if;
  perform set_config('iassistent.federation_link', new.team_id::text, true);
  update public.teams
    set federation_team = new.federation_team, federation_divisions = v_divisions
    where id = new.team_id;
  perform set_config('iassistent.federation_link', '', true);
  return new;
end;
$$;

create trigger club_team_links_after_approved
  after update of status on public.club_team_links
  for each row when (new.status = 'approved' and old.status = 'pending')
  execute function public.after_club_team_link_approved();

-- Adds the stored matches of a linked team to its week input (from this week
-- on, never changing what is there) and the scores of played matches to its
-- match reports (never overwriting the coach's). Returns counts.
create function public.sync_team_competition(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weeks integer := 0;
  v_reports integer := 0;
  v_team record;
  v_match record;
  v_week_start date;
  v_week public.week_plans%rowtype;
  v_entry jsonb;
  v_trainings jsonb;
begin
  select t.id, t.federation_team, t.federation_divisions, t.training_schedule into v_team
  from public.teams t
  where t.id = p_team_id and t.federation_team is not null and t.archived_at is null;
  if not found then
    return jsonb_build_object('weeks', 0, 'reports', 0);
  end if;
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

  return jsonb_build_object('weeks', v_weeks, 'reports', v_reports);
end;
$$;

-- A team that is (newly) linked gets its matches and scores at once.
create function public.after_team_federation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_team_competition(new.id);
  return new;
end;
$$;

create trigger teams_after_federation_change
  after update of federation_team, federation_divisions on public.teams
  for each row
  when (new.federation_team is not null
        and (new.federation_team is distinct from old.federation_team
             or new.federation_divisions is distinct from old.federation_divisions))
  execute function public.after_team_federation_change();

create trigger teams_after_federation_insert
  after insert on public.teams
  for each row when (new.federation_team is not null)
  execute function public.after_team_federation_change();

create or replace function public.admin_import_competition(p_divisions text[], p_matches jsonb, p_standings jsonb, p_referees jsonb)
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
  v_sync jsonb;
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
    select t.id from public.teams t
    where t.federation_team is not null and t.archived_at is null and t.federation_divisions && p_divisions
  loop
    v_sync := public.sync_team_competition(v_team.id);
    v_weeks := v_weeks + (v_sync->>'weeks')::integer;
    v_reports := v_reports + (v_sync->>'reports')::integer;
  end loop;

  return jsonb_build_object('matches', v_matches, 'standings', v_standings, 'referees', v_referees, 'weeks', v_weeks, 'reports', v_reports);
end;
$$;

revoke execute on function public.club_federation_teams(uuid) from anon, public;
revoke execute on function public.request_club_team_link(uuid, uuid, text) from anon, public;
revoke execute on function public.after_club_team_link_approved() from anon, authenticated, public;
revoke execute on function public.sync_team_competition(uuid) from anon, authenticated, public;
revoke execute on function public.after_team_federation_change() from anon, authenticated, public;
grant execute on function public.club_federation_teams(uuid) to authenticated;
grant execute on function public.request_club_team_link(uuid, uuid, text) to authenticated;
