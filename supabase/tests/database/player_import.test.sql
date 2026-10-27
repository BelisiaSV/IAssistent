-- Platform admins: Excel import of players into any (active) team.
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

select tests.create_user('admin@test.local');
select tests.create_user('coach@test.local');
select tests.create_user('other@test.local');
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team', gen_random_uuid()), ('old', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team'), tests.id('coach@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name, archived_at)
select (select id from ids where name = 'old'), tests.id('coach@test.local'), 'Oud', 'Club A', now();
insert into public.players (team_id, first_name, last_name, shirt_number, status)
select (select id from ids where name = 'team'), 'Jan', 'Peeters', 9, 'available';

-- A coach (even the head coach) cannot use the admin functions.
select tests.login('coach@test.local');
select is(public.is_platform_admin(), false, 'a coach is not an admin');
select throws_ok($$select * from public.admin_teams()$$, '42501', null, 'a coach cannot list all teams');
select throws_ok(
  $$select public.admin_import_players((select id from ids where name = 'team'), '[{"first_name": "X", "last_name": "Y"}]')$$,
  '42501', null, 'a coach cannot import through the admin function');
select throws_ok($$select * from public.platform_admins$$, '42501', null, 'coaches cannot read the admin list');
select tests.logout();

select tests.login('admin@test.local');
select is(public.is_platform_admin(), true, 'admin is recognised');
select is((select count(*)::int from public.admin_teams() t where t.id in (select id from ids)), 2, 'admin lists all teams, also of other coaches and archived ones');
select is(
  public.admin_import_players((select id from ids where name = 'team'), $$[
    {"first_name": "Jan", "last_name": "Peeters", "shirt_number": 9, "primary_position": "ST", "secondary_positions": ["CAM"], "preferred_foot": "left", "status": "injured", "expected_return_date": "2026-11-15"},
    {"first_name": "Lars", "last_name": "Maes", "shirt_number": 4, "primary_position": "CB", "secondary_positions": [], "birth_year": 2001, "joined_club_year": 2020},
    {"first_name": "Zonder", "last_name": "Nummer", "secondary_positions": []}
  ]$$::jsonb),
  '{"inserted": 2, "updated": 1}'::jsonb, 'admin imports: same shirt number updates, others are added');
select is((select count(*)::int from public.admin_team_players((select id from ids where name = 'team'))), 3, 'admin sees the imported squad');
select throws_ok(
  $$select public.admin_import_players((select id from ids where name = 'old'), '[]')$$,
  '23514', null, 'no import into an archived team');
select throws_ok(
  $$select public.admin_import_players((select id from ids where name = 'team'), '[{"first_name": "X", "last_name": "Y", "preferred_foot": "hand"}]')$$,
  '22P02', null, 'invalid values are refused');
select tests.logout();

select is((select status::text from public.players where shirt_number = 9 and team_id = (select id from ids where name = 'team')), 'injured', 'existing player updated');
select is((select primary_position from public.players where shirt_number = 9 and team_id = (select id from ids where name = 'team')), 'ST', 'position updated');
select is((select count(*)::int from public.players where team_id = (select id from ids where name = 'team')), 3, 'nobody removed, no duplicates');

select * from finish();
rollback;
