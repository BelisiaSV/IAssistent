-- Team dashboard: home address of the team, address and coach of an opponent.
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

select tests.create_user('coach@test.local');
select tests.create_user('other@test.local');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team', gen_random_uuid()), ('opp', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team'), tests.id('coach@test.local'), 'A', 'Club A';
insert into public.opponents (id, team_id, name)
select (select id from ids where name = 'opp'), (select id from ids where name = 'team'), 'KFC Test';

select tests.login('coach@test.local');
update public.teams set home_address = 'Sportlaan 1, 2000 Antwerpen' where id = (select id from ids where name = 'team');
select is((select home_address from public.teams where id = (select id from ids where name = 'team')),
  'Sportlaan 1, 2000 Antwerpen', 'the head coach sets the home address');
update public.opponents set address = 'Kerkstraat 2, 2500 Lier', coach_name = 'Piet Janssens'
  where id = (select id from ids where name = 'opp');
select is((select coach_name || ' | ' || address from public.opponents where id = (select id from ids where name = 'opp')),
  'Piet Janssens | Kerkstraat 2, 2500 Lier', 'the head coach sets the address and coach of an opponent');
select throws_ok($$update public.teams set home_address = repeat('x', 201) where id = (select id from ids where name = 'team')$$,
  '23514', null, 'the home address is at most 200 characters');
select throws_ok($$update public.opponents set coach_name = repeat('x', 121) where id = (select id from ids where name = 'opp')$$,
  '23514', null, 'the coach name of an opponent is at most 120 characters');

select tests.login('other@test.local');
update public.opponents set coach_name = 'Hacker' where id = (select id from ids where name = 'opp');
update public.teams set home_address = 'Hacker' where id = (select id from ids where name = 'team');
select is((select count(*)::int from public.opponents where id = (select id from ids where name = 'opp')), 0,
  'another coach cannot read the opponent');
select tests.logout();
select is((select coach_name || ' | ' || home_address from public.opponents o join public.teams t on t.id = o.team_id
  where o.id = (select id from ids where name = 'opp')),
  'Piet Janssens | Sportlaan 1, 2000 Antwerpen', 'another coach cannot change them');

select * from finish();
rollback;
