-- Club self-service: one club manager role, invitations by e-mail and the club file.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

create schema tests;
grant usage on schema tests to authenticated;
create function tests.create_user(p_email text, p_confirmed boolean default true) returns uuid language sql as $$
  insert into auth.users (id, email, email_confirmed_at)
  values (gen_random_uuid(), p_email, case when p_confirmed then now() end) returning id;
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

select tests.create_user(e) from unnest(array[
  'owner@test.local', 'manager@test.local', 'td@test.local', 'known@test.local', 'outsider@test.local', 'padmin@test.local'
]) e;
insert into public.platform_admins (coach_id) values (tests.id('padmin@test.local'));

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('team_a', gen_random_uuid());

insert into public.clubs (id, name, created_by, federation_number)
select id, 'Club X', tests.id('owner@test.local'), '1234' from ids where name = 'club';
insert into public.federation_clubs (number, name, teams)
values ('1234', 'Club X', '[{"name": "Club X A", "divisions": ["1", "BVVD"]}]');
insert into public.club_subscriptions (club_id, license_seats) select id, 5 from ids where name = 'club';
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['owner@test.local', 'td@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id,
  case l.coach_id when tests.id('owner@test.local') then 'owner' else 'technical_director' end::public.club_role, l.id
from public.club_licenses l;
insert into public.club_members (club_id, coach_id, role)
select id, tests.id('manager@test.local'), 'admin' from ids where name = 'club';
insert into public.teams (id, head_coach_id, club_id, name, club_name)
select id, tests.id('owner@test.local'), (select id from ids where name = 'club'), 'U15', 'Club X' from ids where name = 'team_a';

-- Owner and admin are one role.
select tests.login('manager@test.local');
select ok(public.has_club_role((select id from ids where name = 'club'), '{owner}'),
  'an admin counts as owner: both are the club manager');
select is(public.save_club_invitation((select id from ids where name = 'club'), ' New@Test.local ', 'Nieuwe trainer',
  'head_coach', (select id from ids where name = 'team_a')), 'invited',
  'the club manager invites a new e-mail');
select is((select email from public.club_invitations where status = 'pending'), 'new@test.local',
  'the e-mail is stored in lower case');
select is(public.club_seats_used((select id from ids where name = 'club')), 3,
  'a pending invitation for a trainer reserves a seat');
select is(public.save_club_invitation((select id from ids where name = 'club'), 'new@test.local', null,
  'coordinator', (select id from ids where name = 'team_a')), 'invited',
  'a second role for the same e-mail');
select is((select count(*)::int from public.club_invitations where status = 'pending'), 1,
  'one invitation per e-mail');
select is((select roles from public.club_invitations where status = 'pending'), '{coach,team_coordinator}'::public.club_role[],
  'the invitation holds both roles');
select is((select name from public.club_invitations where status = 'pending'), 'Nieuwe trainer',
  'an empty name keeps the earlier one');
select throws_ok($$select public.save_club_invitation((select id from ids where name = 'club'), 'x@test.local', null,
  'technical_director', (select id from ids where name = 'team_a'))$$, '23514', null,
  'a technical director has no team');
select throws_ok($$select public.save_club_invitation((select id from ids where name = 'club'), 'geen-mail', null, 'head_coach', null)$$,
  '23514', null, 'an invalid e-mail is refused');
select is(public.save_club_invitation((select id from ids where name = 'club'), 'known@test.local', null,
  'assistant_coach', (select id from ids where name = 'team_a')), 'added',
  'a person with an account joins at once');
select tests.logout();

select ok(exists (select 1 from public.club_members where coach_id = tests.id('known@test.local')
  and role = 'assistant_coach' and license_id is not null), 'the known person is a licensed member');
select ok(exists (select 1 from public.team_staff where coach_id = tests.id('known@test.local')
  and team_id = (select id from ids where name = 'team_a') and role = 'assistant_coach'), 'and on the team staff');

select tests.login('td@test.local');
select throws_ok($$select public.save_club_invitation((select id from ids where name = 'club'), 'y@test.local', null, 'head_coach', null)$$,
  '42501', null, 'a technical director cannot invite');
select is((select count(*)::int from public.club_invitations), 0, 'a technical director does not read the invitations');
select tests.logout();

-- The invited person registers.
select tests.create_user('new@test.local', false);
select tests.login('new@test.local');
select is(public.accept_club_invitations(), '{}'::uuid[], 'an unconfirmed e-mail joins nothing');
select tests.logout();
update auth.users set email_confirmed_at = now() where email = 'new@test.local';
select tests.login('new@test.local');
select is(public.accept_club_invitations(), array[(select id from ids where name = 'club')],
  'a confirmed e-mail joins the club');
select is((select array_agg(role::text order by role) from public.club_members where coach_id = tests.id('new@test.local')),
  '{team_coordinator,coach}'::text[], 'with both roles');
select is((select count(*)::int from public.team_staff where coach_id = tests.id('new@test.local')), 2,
  'and both team places');
select is(public.accept_club_invitations(), '{}'::uuid[], 'accepting again does nothing');
select tests.logout();

-- The club file.
select tests.login('owner@test.local');
select is(public.import_club_file((select id from ids where name = 'club'), '{
  "teams": [{"name": "U15", "age_category": "u15", "federation_team": "Club X A"},
            {"name": "U17", "age_category": "u17"}],
  "people": [{"name": "Trainer U17", "email": "u17@test.local", "role": "head_coach", "team": "U17"},
             {"name": "Gekend", "email": "known@test.local", "role": "head_coach", "team": "U17"}]
}'::jsonb), '{"teams_created": 1, "teams_updated": 1, "invited": 1, "added": 1}'::jsonb,
  'the club file creates and updates teams and invites people');
select tests.logout();
select is((select federation_divisions from public.teams where id = (select id from ids where name = 'team_a')),
  '{1,BVVD}'::text[], 'the team gets its competition team and divisions from the export');
select ok(exists (select 1 from public.team_staff s join public.teams t on t.id = s.team_id
  where t.name = 'U17' and s.coach_id = tests.id('known@test.local') and s.role = 'head_coach'),
  'a known person is put on the new team at once');

select tests.login('owner@test.local');
select throws_ok($$select public.import_club_file((select id from ids where name = 'club'),
  '{"teams": [{"name": "U19", "federation_team": "Onbekend"}]}'::jsonb)$$, '23514', null,
  'an unknown competition team stops the import');
select throws_ok($$select public.import_club_file((select id from ids where name = 'club'), '{"people": [
  {"email": "a@test.local", "role": "head_coach"}, {"email": "b@test.local", "role": "head_coach"},
  {"email": "c@test.local", "role": "head_coach"}]}'::jsonb)$$, '23514', null,
  'the file cannot use more seats than the club has');
select lives_ok($$select public.revoke_club_invitation((select id from public.club_invitations where email = 'u17@test.local'))$$,
  'the club manager withdraws an invitation');
select tests.logout();

select tests.login('outsider@test.local');
select throws_ok($$select public.import_club_file((select id from ids where name = 'club'), '{}'::jsonb)$$, '42501', null,
  'an outsider cannot import');
select tests.logout();

select * from finish();
rollback;
