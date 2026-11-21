-- Training Quality Engine: checks per week run; the team reads them, only the
-- head coach writes, never changed or deleted; daily limit for real AI.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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


select tests.create_user(e) from unnest(array['a@test.local', 'b@test.local', 't2@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.week_plans (team_id, week_start)
select id, '2026-10-19' from ids where name in ('team_a', 'team_b');
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');
with x as (
  insert into public.staff_runs (team_id, week_plan_id, kind, provider, created_by)
  select w.team_id, w.id, 'week', 'example', t.head_coach_id from public.week_plans w join public.teams t on t.id = w.team_id
  returning id, team_id
) insert into ids select case when team_id = (select id from ids where name = 'team_a') then 'run_a' else 'run_b' end, id from x;
with x as (
  insert into public.staff_runs (team_id, week_plan_id, kind, provider, created_by)
  select w.team_id, w.id, 'match', 'example', tests.id('a@test.local') from public.week_plans w
  where w.team_id = (select id from ids where name = 'team_a') returning id
) insert into ids select 'match_a', id from x;

create temp table review as select '{"samenvatting": "x", "criteria": [], "sterke_punten": [], "verbeterpunten": []}'::jsonb as output;
grant select on review to authenticated;

select tests.login('a@test.local');
select lives_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, output, average, verdict, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'ready', output, 3.7, 'voldoende', 'example'
  from review returning id$$, 'the head coach stores a check (insert ... returning)');
select lives_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, error, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'failed', 'timeout', 'example'$$,
  'and a failed check');
select throws_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, output, average, verdict, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'match_a'), 'ready', output, 3, 'voldoende', 'example' from review$$,
  '23514', 'run is not a week run of this team', 'only a week run is checked');
select throws_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, output, average, verdict, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_b'), 'ready', output, 3, 'voldoende', 'example' from review$$,
  '23514', 'run is not a week run of this team', 'not with the run of another team');
select throws_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'ready', 'example'$$,
  '23514', null, 'a ready check has its output, average and verdict');
select throws_ok($$update public.training_quality_reviews set average = 5$$, '42501', null, 'a check is never changed');
select throws_ok($$delete from public.training_quality_reviews$$, '42501', null, 'or deleted');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.training_quality_reviews), 2, 'the T2 reads the checks');
select throws_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, error, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'failed', 'x', 'example'$$,
  '42501', null, 'but does not write');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.training_quality_reviews), 0, 'another coach sees nothing');
select tests.logout();

-- Daily limit for real AI
insert into public.training_quality_reviews (team_id, run_id, status, error, provider, created_by)
select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'failed', 'x', 'anthropic', tests.id('a@test.local')
from generate_series(1, public.staff_quality_daily_limit());
select tests.login('a@test.local');
select is(public.staff_quality_remaining_today(), 0, 'nothing left today');
select throws_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, error, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'failed', 'x', 'anthropic'$$,
  '23514', 'daily limit of quality checks reached', 'the daily limit holds for real AI');
select lives_ok($$
  insert into public.training_quality_reviews (team_id, run_id, status, error, provider)
  select (select id from ids where name = 'team_a'), (select id from ids where name = 'run_a'), 'failed', 'x', 'example'$$,
  'test mode does not count');
select tests.logout();

select * from finish();
rollback;
