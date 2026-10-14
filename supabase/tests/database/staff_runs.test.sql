-- Staff runs: one request of the head coach, versions per kind, daily AI limit.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

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
insert into public.week_plans (team_id, week_start) select id, '2026-10-19' from ids where name = 'team_a';
insert into ids select 'week_a', id from public.week_plans where week_start = '2026-10-19';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'example'
    returning id$$,
  'head coach requests a week document (insert ... returning)');
insert into ids select 'run_1', id from public.staff_runs where kind = 'week' and version = 1;
insert into public.staff_runs (team_id, week_plan_id, kind, provider)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), kind, 'example'
from (values ('week'), ('match')) v(kind);
select results_eq(
  $$select kind, version from public.staff_runs order by kind, version$$,
  $$values ('match'::text, 1), ('week'::text, 1), ('week'::text, 2)$$,
  'versions are numbered per kind');

select lives_ok(
  $$insert into public.staff_proposals (team_id, week_plan_id, role, task, provider, run_id, step, status)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'),
           'physical-coach', 'default', 'example', (select id from ids where name = 'run_1'), 'pc', 'pending'
    returning id$$,
  'a run creates pending proposals per step');
select lives_ok(
  $$update public.staff_proposals set status = 'generating' where status = 'pending'$$,
  'a pending step is claimed');
select is((select status::text from public.staff_proposals where step = 'pc'), 'generating', 'status changed');

select lives_ok(
  $$update public.staff_runs set status = 'approved', decided_at = now() where id = (select id from ids where name = 'run_1')$$,
  'head coach approves a run');
select throws_ok(
  $$update public.staff_runs set feedback = 'anders' where id = (select id from ids where name = 'run_1')$$,
  '42501', null, 'feedback of a run cannot be changed afterwards');
select throws_ok(
  $$delete from public.staff_runs$$,
  '42501', null, 'runs cannot be deleted');
select throws_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_b'), (select id from ids where name = 'week_a'), 'week', 'example'$$,
  '23514', 'week plan does not belong to the team', 'cannot attach a run to a week of another team');

-- Daily AI limit: 5 requests per coach per day; test mode does not count.
insert into public.staff_runs (team_id, week_plan_id, kind, provider)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'anthropic'
from generate_series(1, 5);
select throws_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'match', 'anthropic'$$,
  '23514', 'daily limit of staff requests reached', 'the sixth AI request of the day is refused');
select lives_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'example'$$,
  'test mode is not limited');
select tests.logout();

select tests.login('t2@test.local');
select ok((select count(*) from public.staff_runs) > 0, 'T2 reads runs');
select throws_ok(
  $$insert into public.staff_runs (team_id, week_plan_id, kind, provider)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'week_a'), 'week', 'example'$$,
  '42501', null, 'T2 cannot request a run');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.staff_runs), 0, 'other coach does not see runs');
select tests.logout();

select * from finish();
rollback;
