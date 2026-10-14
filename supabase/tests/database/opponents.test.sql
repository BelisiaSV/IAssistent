-- Opponents, opponent lineups, match reports and proposal tasks.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

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
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()), ('opp_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.opponents (id, team_id, name)
select (select id from ids where name = 'opp_b'), (select id from ids where name = 'team_b'), 'Tegenstander van B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.opponents (team_id, name, play_style) select id, 'KFC Voorbeeld', 'Direct' from ids where name = 'team_a' returning id$$,
  'head coach creates an opponent (insert ... returning)');
select throws_ok(
  $$insert into public.opponents (team_id, name) select id, ' kfc voorbeeld ' from ids where name = 'team_a'$$,
  '23505', null, 'opponent names are unique per team (case-insensitive)');
insert into ids select 'opp_a', id from public.opponents where name = 'KFC Voorbeeld';

select lives_ok(
  $$insert into public.opponent_lineups (team_id, opponent_id, formation, starters, bench)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'opp_a'), '4-4-2',
           '{"ST": {"number": 9, "name": "Spits"}}', '[{"number": 12, "name": "Wissel"}]'
    returning id$$,
  'head coach stores an opponent lineup (insert ... returning)');
select throws_ok(
  $$insert into public.opponent_lineups (team_id, opponent_id, formation)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'opp_b'), '4-4-2'$$,
  '23514', 'opponent does not belong to the team', 'lineup only for own opponents');
select throws_ok(
  $$insert into public.opponent_lineups (team_id, opponent_id, formation, source)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'opp_a'), '4-4-2', 'ai'$$,
  '23514', null, 'source is coach or video');

select lives_ok(
  $$insert into public.match_reports (team_id, match_date, opponent_id, opponent_name, home, goals_for, goals_against, own_formation, opponent_formation, went_well)
    select (select id from ids where name = 'team_a'), '2026-10-18', (select id from ids where name = 'opp_a'), 'KFC Voorbeeld', true, 2, 1, '4-3-3', '4-4-2', 'Druk na balverlies'
    returning id$$,
  'head coach stores a match report (insert ... returning)');
select throws_ok(
  $$insert into public.match_reports (team_id, match_date, opponent_name) select id, '2026-10-18', 'X' from ids where name = 'team_a'$$,
  '23505', null, 'one report per match date');

-- Proposal tasks: versions per task.
insert into public.week_plans (team_id, week_start) select id, '2026-10-19' from ids where name = 'team_a';
insert into ids select 'week_a', id from public.week_plans where week_start = '2026-10-19';
insert into public.staff_proposals (team_id, week_plan_id, role, provider)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'tactical-coach', 'example';
select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, task, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'tactical-coach', 'oefenstof', 'example'
    returning id$$,
  'head coach requests a second task of a role');
select results_eq(
  $$select task, version from public.staff_proposals order by task$$,
  $$values ('default'::text, 1), ('oefenstof'::text, 1)$$,
  'versions are numbered per task');

select lives_ok(
  $$insert into public.lineups (team_id, title, formation, source) select id, 'Voorstel', '4-3-3', 'tactical-coach' from ids where name = 'team_a'$$,
  'a lineup can be marked as proposed by the Tactical Coach');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.opponents), 1, 'other coach only sees own opponents');
select is((select count(*)::int from public.match_reports), 0, 'other coach does not see match reports');
select is((select count(*)::int from public.opponent_lineups), 0, 'other coach does not see opponent lineups');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.opponent_lineups), 1, 'T2 reads opponent lineups');
select throws_ok(
  $$insert into public.opponents (team_id, name) select id, 'Nieuw' from ids where name = 'team_a'$$,
  '42501', null, 'T2 cannot create opponents');
select throws_ok(
  $$insert into public.match_reports (team_id, match_date, opponent_name) select id, '2026-10-25', 'X' from ids where name = 'team_a'$$,
  '42501', null, 'T2 cannot write match reports');
select tests.logout();

select * from finish();
rollback;
