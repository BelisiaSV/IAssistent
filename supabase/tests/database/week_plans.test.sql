-- Week plans and staff proposals: RLS and versions.
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
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

-- Head coach ------------------------------------------------------------------
select tests.login('a@test.local');

select lives_ok(
  $$update public.teams set training_schedule = '[{"weekday": 2, "start": "19:30", "duration_min": 90}]'
    where name = 'A'$$,
  'head coach sets the standard training schedule');
select lives_ok(
  $$insert into public.week_plans (team_id, week_start, trainings, matches)
    select id, date '2026-10-19',
      '[{"date": "2026-10-20", "start": "19:30", "duration_min": 90}]',
      '[{"date": "2026-10-25", "start": "15:00", "opponent": "X", "home": true}]'
    from ids where name = 'team_a'
    returning id$$,
  'head coach saves a week (insert ... returning)');
select throws_ok(
  $$insert into public.week_plans (team_id, week_start) select id, date '2026-10-21' from ids where name = 'team_a'$$,
  '23514', null, 'week_start must be a Monday');
select throws_ok(
  $$insert into public.week_plans (team_id, week_start) select id, date '2026-10-19' from ids where name = 'team_b'$$,
  '42501', null, 'cannot create a week for another team');

insert into ids select 'week_a', id from public.week_plans where week_start = '2026-10-19';

select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'example'
    returning id, version$$,
  'head coach requests a proposal (insert ... returning)');
insert into public.staff_proposals (team_id, week_plan_id, role, provider, feedback)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'example', 'Minder conditie';
select results_eq(
  $$select version from public.staff_proposals order by version$$,
  $$values (1), (2)$$,
  'versions are numbered per week and role');

select lives_ok(
  $$update public.staff_proposals set status = 'ready', output = '{"weekfocus": "x"}' where version = 1$$,
  'result can be stored');
select throws_ok(
  $$update public.staff_proposals set feedback = 'gewijzigd' where version = 1$$,
  '42501', null, 'feedback of an earlier version cannot be changed');
select throws_ok(
  $$delete from public.staff_proposals$$,
  '42501', null, 'proposals cannot be deleted');
select throws_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, provider)
    select (select id from ids where name = 'team_b'), (select id from ids where name = 'week_a'), 'assistant-coach', 'example'$$,
  '23514', 'week plan does not belong to the team', 'cannot attach a proposal to a week of another team');

-- The daily AI limit counts staff runs (see staff_runs.test.sql), not single proposals.
insert into public.staff_proposals (team_id, week_plan_id, role, provider)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'anthropic'
from generate_series(1, 5);
select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'anthropic'$$,
  'single proposals are not limited (a run is)');
select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'example'$$,
  'test mode is not limited');
select tests.logout();

-- Others ----------------------------------------------------------------------
select tests.login('b@test.local');
select is((select count(*)::int from public.week_plans), 0, 'other coach does not see the week');
select is((select count(*)::int from public.staff_proposals), 0, 'other coach does not see proposals');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.staff_proposals where version = 1), 1, 'T2 reads proposals');
select throws_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'assistant-coach', 'example'$$,
  '42501', null, 'T2 cannot request proposals');
select tests.logout();

select * from finish();
rollback;
