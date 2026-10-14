-- Season settings, session loads (RPE) and fitness tests: RLS and rules.
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

select tests.create_user('a@test.local');
select tests.create_user('b@test.local');
select tests.create_user('t2@test.local');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()),
  ('p_a', gen_random_uuid()), ('p_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.players (id, team_id, first_name, last_name)
select (select id from ids where name = 'p_a'), (select id from ids where name = 'team_a'), 'P', 'A';
insert into public.players (id, team_id, first_name, last_name)
select (select id from ids where name = 'p_b'), (select id from ids where name = 'team_b'), 'P', 'B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$update public.teams set competition_start_date = '2026-09-06', periodization_weeks = 6 where name = 'A'$$,
  'head coach sets season settings');
select throws_ok(
  $$update public.teams set periodization_weeks = 5 where name = 'A'$$,
  '23514', null, 'cycle must be 4, 6 or 8 weeks');
select lives_ok(
  $$update public.teams set preparation_start_date = '2026-07-06', preparation_weeks = 8 where name = 'A'$$,
  'head coach plans the preparation with its own cycle');
select throws_ok(
  $$update public.teams set preparation_start_date = '2026-09-20' where name = 'A'$$,
  '23514', null, 'preparation starts before the competition');
select throws_ok(
  $$update public.teams set preparation_weeks = 3 where name = 'A'$$,
  '23514', null, 'preparation cycle must be 4, 6 or 8 weeks');

select lives_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min, attendance)
    select id, '2026-10-13', 'training', 5.5, 85, 18 from ids where name = 'team_a' returning id$$,
  'head coach logs the RPE of a session (insert ... returning)');
select throws_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min)
    select id, '2026-10-13', 'training', 6, 90 from ids where name = 'team_a'$$,
  '23505', null, 'one record per session');
select throws_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min)
    select id, '2026-10-14', 'training', 11, 90 from ids where name = 'team_a'$$,
  '23514', null, 'RPE is between 0 and 10');
select throws_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min)
    select id, '2026-10-14', 'training', 5, 90 from ids where name = 'team_b'$$,
  '42501', null, 'cannot log load for another team');

select lives_ok(
  $$insert into public.fitness_tests (team_id, player_id, test_code, test_date, result)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_a'), 'vameval', '2026-09-01', 16.5
    returning id$$,
  'head coach stores a VAMEVAL result (insert ... returning)');
select throws_ok(
  $$insert into public.fitness_tests (team_id, player_id, test_code, test_date, result)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_b'), 'vameval', '2026-09-01', 15$$,
  '23514', 'player does not belong to the team', 'test results only for players of the team');
select throws_ok(
  $$insert into public.fitness_tests (team_id, player_id, test_code, test_date, result)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_a'), 'vameval', '2026-09-01', 17$$,
  '23505', null, 'one result per player, test and date');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.session_loads), 0, 'other coach does not see session loads');
select is((select count(*)::int from public.fitness_tests), 0, 'other coach does not see test results');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.fitness_tests), 1, 'T2 reads test results');
select throws_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min)
    select id, '2026-10-15', 'training', 5, 90 from ids where name = 'team_a'$$,
  '42501', null, 'T2 cannot log load');
select tests.logout();

select tests.login('a@test.local');
update public.teams set archived_at = now() where name = 'A';
select throws_ok(
  $$insert into public.session_loads (team_id, session_date, kind, rpe, duration_min)
    select id, '2026-10-15', 'training', 5, 90 from ids where name = 'team_a'$$,
  '42501', null, 'archived team is read-only');
select tests.logout();

select * from finish();
rollback;
