-- The week plan of a staff meeting as a version of the week document: provider
-- 'staffkamer', linked to a meeting of the same team, not counted as AI request.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

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

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()), ('week_a', gen_random_uuid()), ('m_a', gen_random_uuid()), ('m_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.week_plans (id, team_id, week_start)
select (select id from ids where name = 'week_a'), (select id from ids where name = 'team_a'), date '2026-11-16';
insert into public.staff_meetings (id, team_id, assignment, created_by)
select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_a'), 'Week', tests.id('a@test.local');
insert into public.staff_meetings (id, team_id, assignment, created_by)
select (select id from ids where name = 'm_b'), (select id from ids where name = 'team_b'), 'Week', tests.id('b@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider, status, meeting_id)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'staffkamer', 'ready', (select id from ids where name = 'm_a')
    returning id$$,
  'head coach puts a staff meeting in the week (insert ... returning)');
insert into ids select 'run_a', id from public.staff_runs where meeting_id = (select id from ids where name = 'm_a');
select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, run_id, step, role, task, status, output, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), (select id from ids where name = 'run_a'),
           'ac', 'assistant-coach', 'default', 'ready', '{"dagen": []}', 'staffkamer'
    returning id$$,
  'with the week plan as Assistant Coach step');
select throws_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider, meeting_id)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'staffkamer', (select id from ids where name = 'm_b')$$,
  '23514', 'meeting does not belong to the team', 'only a meeting of the same team');
select throws_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'iets'$$,
  '23514', null, 'the provider is known');
select lives_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'staffkamer'
    from generate_series(1, public.staff_daily_limit() + 1)$$,
  'versions from the staff room do not count for the daily AI limit');
select is((select count(*)::int from public.staff_runs), public.staff_daily_limit() + 2, 'all versions are stored');
select tests.logout();

select * from finish();
rollback;
