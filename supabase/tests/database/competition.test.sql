-- Competition import: only admins link teams and import; coaches read the
-- divisions of their teams; the import fills week input and match reports
-- without overwriting what the head coach entered.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

create schema tests;
grant usage on schema tests to authenticated;
create function tests.create_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email) values (gen_random_uuid(), p_email) returning id;
$$;
create function tests.id(p_email text) returns uuid language sql stable security definer as $$
  select id from auth.users where email = p_email;
$$;
create function tests.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_email), 'role', 'authenticated')::text, true);
end;
$$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
grant execute on all functions in schema tests to authenticated;

select tests.create_user('admin@test.local');
select tests.create_user('a@test.local');
select tests.create_user('b@test.local');
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name, training_schedule)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A',
       '[{"weekday": 2, "start": "19:30", "duration_min": 90}, {"weekday": 5, "start": "19:30", "duration_min": 75}]';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';

-- Dates relative to today: a played match last week, one next week (on a Friday,
-- a training day), and a match of other teams.
create temp table d on commit drop as
select current_date - (extract(isodow from current_date)::integer - 1) - 7 + 6 as played,
       current_date - (extract(isodow from current_date)::integer - 1) + 7 + 4 as next_friday,
       current_date - (extract(isodow from current_date)::integer - 1) + 7 as next_monday;
grant all on d to authenticated;
create temp table payload on commit drop as
select jsonb_build_array(
  jsonb_build_object('division', '1', 'date', (select played from d), 'kickoff', '15:00', 'home', 'Club A Eerste', 'away', 'Ander FC', 'home_goals', 2, 'away_goals', 1, 'matchday', 1, 'home_club', '00001', 'away_club', '00002'),
  jsonb_build_object('division', '1', 'date', (select next_friday from d), 'kickoff', '20:30', 'home', 'Derde VV', 'away', 'Club A Eerste', 'matchday', 2),
  jsonb_build_object('division', '1', 'date', (select played from d), 'kickoff', '15:00', 'home', 'Derde VV', 'away', 'Vierde SK', 'home_goals', 0, 'away_goals', 0, 'matchday', 1),
  jsonb_build_object('division', 'X', 'date', (select played from d), 'home', 'Iemand', 'away', 'Anders', 'home_goals', 1, 'away_goals', 1)
) as matches,
jsonb_build_array(
  jsonb_build_object('division', '1', 'period', 0, 'position', 1, 'team', 'Club A Eerste', 'played', 1, 'won', 1, 'lost', 0, 'drawn', 0, 'goals_for', 2, 'goals_against', 1, 'points', 3),
  jsonb_build_object('division', '1', 'period', 0, 'position', 2, 'team', 'Derde VV', 'played', 1, 'won', 0, 'lost', 0, 'drawn', 1, 'goals_for', 0, 'goals_against', 0, 'points', 1)
) as standings,
jsonb_build_array(
  jsonb_build_object('division', '1', 'date', (select next_friday from d), 'kickoff', '20:30', 'home', 'Derde VV', 'away', 'Club A Eerste', 'referee', 'Scheids Jan', 'match_type', 'CHP')
) as referees;
grant all on payload to authenticated;

select tests.login('a@test.local');
select throws_ok(
  $$update public.teams set federation_team = 'Club A Eerste' where id = (select id from ids where name = 'team_a')$$,
  '42501', null, 'a head coach does not link his team to the competition');
select throws_ok(
  $$select public.admin_set_team_competition((select id from ids where name = 'team_a'), 'Club A Eerste', '{1}')$$,
  '42501', null, 'a head coach cannot use the admin link');
select throws_ok(
  $$select public.admin_import_competition('{1}', (select matches from payload), '[]', '[]')$$,
  '42501', null, 'a head coach cannot import');
update public.teams set name = 'A1' where id = (select id from ids where name = 'team_a');
select is((select name from public.teams where id = (select id from ids where name = 'team_a')), 'A1', 'a head coach still updates his team');
select tests.logout();

select tests.login('admin@test.local');
select lives_ok(
  $$select public.admin_set_team_competition((select id from ids where name = 'team_a'), ' Club A Eerste ', '{1}')$$,
  'an admin links a team');
select is(
  (select public.admin_import_competition('{1}', (select matches from payload), (select standings from payload), (select referees from payload)))->>'matches',
  '3', 'the import keeps the linked divisions only');
select tests.logout();

-- A head coach entered a score for the played match before? Not here: the report is created.
select is((select count(*)::int from public.competition_matches where division = 'X'), 0, 'unlinked divisions are not stored');
select is((select referee from public.competition_matches where home = 'Derde VV' and away = 'Club A Eerste'), 'Scheids Jan', 'referees are set on the match');

select tests.login('a@test.local');
select is((select count(*)::int from public.competition_matches), 3, 'a head coach reads the matches of his division');
select is((select count(*)::int from public.competition_standings), 2, 'and its standings');
select is(
  (select goals_for || '-' || goals_against || ' ' || opponent_name || ' ' || home from public.match_reports where team_id = (select id from ids where name = 'team_a')),
  '2-1 Ander FC true', 'the score of a played match goes to the match report');
select is(
  (select matches->0->>'opponent' || ' ' || (matches->0->>'home') || ' ' || jsonb_array_length(trainings)
   from public.week_plans where team_id = (select id from ids where name = 'team_a') and week_start = (select next_monday from d)),
  'Derde VV false 1', 'the next match goes to a new week, without a training on the match day');
-- The coach changes the score and moves the match in the week input.
update public.match_reports set goals_for = 3 where team_id = (select id from ids where name = 'team_a');
update public.week_plans set matches = jsonb_build_array(jsonb_build_object('date', (select next_friday from d), 'start', '19:00', 'opponent', 'Derde VV (eigen)', 'home', false))
where team_id = (select id from ids where name = 'team_a');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.competition_matches) + (select count(*)::int from public.competition_standings), 0,
  'a coach of another team sees nothing of the division');
select tests.logout();

select tests.login('admin@test.local');
select lives_ok(
  $$select public.admin_import_competition('{1}', (select matches from payload), (select standings from payload), (select referees from payload))$$,
  'an admin imports again');
select tests.logout();

select is((select count(*)::int from public.competition_matches), 3, 'importing again replaces the matches of the division');
select is((select goals_for from public.match_reports where team_id = (select id from ids where name = 'team_a')), 3::smallint,
  'the import never overwrites the score of the head coach');
select is(
  (select matches->0->>'opponent' || ' ' || jsonb_array_length(matches) from public.week_plans where team_id = (select id from ids where name = 'team_a')),
  'Derde VV (eigen) 1', 'the import never changes the week input of the head coach');

select * from finish();
rollback;
