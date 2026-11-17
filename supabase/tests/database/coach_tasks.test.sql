-- Tasks of the head coach: he adds, ticks off and removes them; a T2 reads
-- them only; another coach sees nothing.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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


select tests.login('a@test.local');
select lives_ok(
  $$insert into public.coach_tasks (team_id, title) select id, 'Maak een individuele videoanalyse van #7' from ids where name = 'team_a' returning id$$,
  'head coach adds a task (insert ... returning)');
update public.coach_tasks set done = true, done_at = now();
select is((select done from public.coach_tasks), true, 'head coach ticks a task off');
select throws_ok(
  $$insert into public.coach_tasks (team_id, title) select id, 'x' from ids where name = 'team_b'$$,
  '42501', null, 'not for another team');
select throws_ok(
  $$insert into public.coach_tasks (team_id, title) select id, '  ' from ids where name = 'team_a'$$,
  '23514', null, 'a task has a title');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.coach_tasks), 1, 'a T2 reads the tasks');
delete from public.coach_tasks;
select tests.logout();
select is((select count(*)::int from public.coach_tasks), 1, 'a T2 cannot remove a task');

select tests.login('b@test.local');
select is((select count(*)::int from public.coach_tasks), 0, 'another coach sees nothing');
select tests.logout();

select tests.login('a@test.local');
delete from public.coach_tasks;
select is((select count(*)::int from public.coach_tasks), 0, 'head coach removes a task');
select tests.logout();

select * from finish();
rollback;
