-- Club environment, part 3: people list, pending links and seat count for the
-- club's own screens.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

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

select tests.create_user(e) from unnest(array['owner@test.local', 'td@test.local', 'coach@test.local', 'outsider@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('team_p', gen_random_uuid());

insert into public.clubs (id, name, created_by) select id, 'Club X', tests.id('owner@test.local') from ids where name = 'club';
insert into public.club_subscriptions (club_id, license_seats) select id, 5 from ids where name = 'club';
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['owner@test.local', 'td@test.local', 'coach@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id,
  case l.coach_id when tests.id('owner@test.local') then 'owner' when tests.id('td@test.local') then 'technical_director' else 'coach' end::public.club_role,
  l.id
from public.club_licenses l;
insert into public.teams (id, head_coach_id, name, club_name)
select id, tests.id('coach@test.local'), 'Mijn ploeg', 'Eigen club' from ids where name = 'team_p';

select tests.login('coach@test.local');
select lives_ok($$select public.request_club_team_link((select id from ids where name = 'team_p'), (select id from ids where name = 'club'))$$,
  'the coach asks to link his team');
select throws_ok($$select * from public.club_pending_links((select id from ids where name = 'club'))$$, '42501', null,
  'a coach cannot list the pending links');
select throws_ok($$select * from public.club_people((select id from ids where name = 'club'))$$, '42501', null,
  'a coach cannot list the people of the club');
select is(public.club_seats_used((select id from ids where name = 'club')), 3, 'a member reads the seats in use');
select tests.logout();

select tests.login('owner@test.local');
select is((select team_name from public.club_pending_links((select id from ids where name = 'club'))), 'Mijn ploeg',
  'the owner sees the pending link with the team name');
select is((select count(*)::int from public.teams), 0, 'the owner still cannot read the personal team itself');
select is((select count(*)::int from public.club_people((select id from ids where name = 'club'))), 3, 'the owner lists the people');
select tests.logout();

select tests.login('td@test.local');
select is((select roles from public.club_people((select id from ids where name = 'club')) where coach_id = tests.id('coach@test.local')),
  '{coach}'::text[], 'the technical director lists the people with their roles');
select throws_ok($$select * from public.club_pending_links((select id from ids where name = 'club'))$$, '42501', null,
  'only owner and admin handle link requests');
select tests.logout();

select tests.login('outsider@test.local');
select is(public.club_seats_used((select id from ids where name = 'club')), 0, 'an outsider learns nothing about the seats');
select tests.logout();

select * from finish();
rollback;
