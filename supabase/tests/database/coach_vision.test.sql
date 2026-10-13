-- Coach vision profile: only the coach writes it, limits are enforced.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

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

select tests.login('a@test.local');
select lives_ok(
  $$update public.coach_profiles
    set vision_summary = 'Dominant voetbal met hoge druk.',
        vision = '{"versie": "0.1.0", "antwoorden": {"speelwijze.basisformatie": "4-3-3"}}'
    where coach_id = tests.id('a@test.local')
    returning coach_id$$,
  'coach saves own vision (update ... returning)');
select is(
  (select vision #>> '{antwoorden,speelwijze.basisformatie}' from public.coach_profiles
   where coach_id = tests.id('a@test.local')),
  '4-3-3', 'answer is stored');
select throws_ok(
  $$update public.coach_profiles set vision_summary = repeat('x', 2001)
    where coach_id = tests.id('a@test.local')$$,
  '23514', null, 'summary is limited to 2000 characters');
select throws_ok(
  $$update public.coach_profiles set vision = '[]' where coach_id = tests.id('a@test.local')$$,
  '23514', null, 'vision must be a JSON object');
select tests.logout();

select tests.login('b@test.local');
update public.coach_profiles set vision_summary = 'overschreven' where coach_id = tests.id('a@test.local');
select tests.logout();
select is(
  (select vision_summary from public.coach_profiles where coach_id = tests.id('a@test.local')),
  'Dominant voetbal met hoge druk.', 'another coach cannot change the vision');

select * from finish();
rollback;
