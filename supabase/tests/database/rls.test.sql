-- RLS and business rules of the foundation schema.
-- Run: pnpm test:db   (or: supabase test db, against a local Supabase)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(48);

-- -----------------------------------------------------------------------------
-- Helpers (exist only inside this transaction)
-- -----------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), p_email, jsonb_build_object('full_name', split_part(p_email, '@', 1)))
  returning id;
$$;

create function tests.login(p_email text) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  select id into strict v_id from auth.users where email = p_email;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
end;
$$;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function tests.id(p_email text) returns uuid language sql stable security definer as $$
  select id from auth.users where email = p_email;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fixtures (as postgres)
-- -----------------------------------------------------------------------------
select tests.create_user('a@test.local');        -- head coach of team A
select tests.create_user('b@test.local');        -- head coach of team B
select tests.create_user('t2@test.local');       -- active T2 on team A
select tests.create_user('t2old@test.local');    -- expired T2 on team A
select tests.create_user('owner@test.local');    -- owner of club C
select tests.create_user('d@test.local');        -- head coach of club team C1

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, anon;

insert into ids values
  ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()),
  ('club_c', gen_random_uuid()), ('team_c1', gen_random_uuid());

insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'Team A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'Team B', 'Club B';

insert into public.clubs (id, name, license_seats, created_by)
select (select id from ids where name = 'club_c'), 'Club C', 2, tests.id('owner@test.local');
insert into public.teams (id, head_coach_id, club_id, name, club_name)
select (select id from ids where name = 'team_c1'), tests.id('d@test.local'),
       (select id from ids where name = 'club_c'), 'Team C1', 'Club C';

insert into public.players (team_id, first_name, last_name)
select id, 'Speler', name from ids where name in ('team_a', 'team_b', 'team_c1');

insert into public.memberships (coach_id, role, team_id, valid_from, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() - interval '1 day', now() + interval '30 days', tests.id('a@test.local');
insert into public.memberships (coach_id, role, team_id, valid_from, valid_until, granted_by)
select tests.id('t2old@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() - interval '60 days', now() - interval '1 day', tests.id('a@test.local');

-- -----------------------------------------------------------------------------
-- Seed and triggers
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.coaches where email = 'coach@iassistent.test'), 1,
  'seed: test coach exists');
select is((select count(*)::int from public.teams where head_coach_id = '11111111-1111-4111-8111-111111111111'), 1,
  'seed: test team exists');
select is((select count(*)::int from public.coach_profiles where coach_id = tests.id('a@test.local')), 1,
  'new auth user gets an empty vision profile');
select is((select count(*)::int from public.memberships
           where club_id = (select id from ids where name = 'club_c') and role = 'club_owner'), 1,
  'club creator becomes club owner');

-- -----------------------------------------------------------------------------
-- Anonymous
-- -----------------------------------------------------------------------------
set local role anon;
select throws_ok('select count(*) from public.teams', '42501', null, 'anon cannot read teams');
select throws_ok('select count(*) from public.players', '42501', null, 'anon cannot read players');
reset role;

-- -----------------------------------------------------------------------------
-- Head coach
-- -----------------------------------------------------------------------------
select tests.login('a@test.local');
select results_eq('select name from public.teams', $$values ('Team A')$$,
  'head coach sees only own team');
select is((select count(*)::int from public.players), 1, 'head coach sees only own players');
select lives_ok(
  $$insert into public.players (team_id, first_name, last_name)
    select id, 'Nieuwe', 'Speler' from ids where name = 'team_a'$$,
  'head coach adds a player to own team');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name)
    select id, 'X', 'Y' from ids where name = 'team_b'$$,
  '42501', null, 'head coach cannot add a player to another team');
select is((select count(*)::int from public.coaches), 3,
  'head coach sees self and the T2s he granted access (also expired), not other coaches');
select throws_ok(
  $$update public.teams set head_coach_id = tests.id('b@test.local') where name = 'Team A'$$,
  '23514', 'head_coach_id and club_id of a team cannot be changed',
  'head coach cannot hand the team to another coach');
select throws_ok('delete from public.teams', '42501', null, 'teams cannot be deleted');
select throws_ok(
  $$insert into public.memberships (coach_id, role, club_id)
    select tests.id('a@test.local'), 'club_owner', id from ids where name = 'club_c'$$,
  '42501', null, 'coach cannot make himself club owner');
select throws_ok(
  $$insert into public.memberships (coach_id, role, team_id, valid_until)
    select tests.id('b@test.local'), 'assistant_coach', id, now() + interval '7 days'
    from ids where name = 'team_b'$$,
  '42501', null, 'coach cannot grant T2 access on someone else''s team');
select lives_ok(
  $$insert into public.memberships (coach_id, role, team_id, valid_until)
    select tests.id('b@test.local'), 'assistant_coach', id, now() + interval '7 days'
    from ids where name = 'team_a'$$,
  'head coach grants temporary T2 access');
select throws_ok(
  $$insert into public.memberships (coach_id, role, team_id)
    select tests.id('d@test.local'), 'assistant_coach', id from ids where name = 'team_a'$$,
  '23514', null, 'T2 access without end date is rejected');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Other head coach
-- -----------------------------------------------------------------------------
select tests.login('b@test.local');
select is((select count(*)::int from public.players p
           join ids on ids.id = p.team_id and ids.name = 'team_a'), 2,
  'coach B now sees team A players through the T2 access just granted');
select tests.logout();
delete from public.memberships where coach_id = tests.id('b@test.local');

select tests.login('b@test.local');
select is((select count(*)::int from public.teams where name = 'Team A'), 0,
  'other coach cannot see team A');
select is((select count(*)::int from public.coach_profiles where coach_id = tests.id('a@test.local')), 0,
  'other coach cannot read a vision that is not shared');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Temporary T2 access
-- -----------------------------------------------------------------------------
select tests.login('t2@test.local');
select results_eq('select name from public.teams', $$values ('Team A')$$, 'active T2 sees the team');
select is((select count(*)::int from public.players), 2, 'active T2 sees the players');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name)
    select id, 'X', 'Y' from ids where name = 'team_a'$$,
  '42501', null, 'T2 has read-only access');
select is((select count(*)::int from public.coach_profiles where coach_id = tests.id('a@test.local')), 0,
  'T2 does not see the head coach''s vision unless shared');
select tests.logout();

select tests.login('t2old@test.local');
select is((select count(*)::int from public.teams), 0, 'expired T2 sees nothing');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Club owner
-- -----------------------------------------------------------------------------
select tests.login('owner@test.local');
select results_eq('select name from public.teams', $$values ('Team C1')$$,
  'club owner sees the club''s teams only');
select is((select count(*)::int from public.players), 1, 'club owner sees the club''s players');
select is((select count(*)::int from public.coach_profiles where coach_id = tests.id('d@test.local')), 0,
  'club owner does not see the coach''s vision without consent');
select throws_ok(
  $$update public.clubs set license_seats = 99$$,
  '42501', null, 'club owner cannot change licence seats');
select lives_ok(
  $$insert into public.teams (head_coach_id, club_id, name, club_name)
    select tests.id('d@test.local'), id, 'Team C2', 'Club C' from ids where name = 'club_c'$$,
  'club owner creates a team within licence seats');
select throws_ok(
  $$insert into public.teams (head_coach_id, club_id, name, club_name)
    select tests.id('d@test.local'), id, 'Team C3', 'Club C' from ids where name = 'club_c'$$,
  '23514', 'club has no free license seats', 'licence seats are enforced');
select tests.logout();

-- Vision sharing with consent
select tests.login('d@test.local');
select lives_ok(
  $$insert into public.coach_profile_shares (coach_id, shared_with_club_id)
    select tests.id('d@test.local'), id from ids where name = 'club_c'$$,
  'coach shares vision with the club');
select throws_ok(
  $$insert into public.coach_profile_shares (coach_id, shared_with_coach_id)
    values (tests.id('a@test.local'), tests.id('d@test.local'))$$,
  '42501', null, 'nobody can share someone else''s vision');
select tests.logout();

select tests.login('owner@test.local');
select is((select count(*)::int from public.coach_profiles where coach_id = tests.id('d@test.local')), 1,
  'club owner sees the vision after consent');
update public.coach_profiles set vision_summary = 'gewijzigd' where coach_id = tests.id('d@test.local');
select tests.logout();
select is((select vision_summary from public.coach_profiles where coach_id = tests.id('d@test.local')), null,
  'shared vision is read-only for others');

-- -----------------------------------------------------------------------------
-- Archived team stays readable, becomes read-only
-- -----------------------------------------------------------------------------
select tests.login('a@test.local');
select lives_ok($$update public.teams set archived_at = now() where name = 'Team A'$$,
  'head coach archives the team');
select is((select count(*)::int from public.teams where name = 'Team A'), 1,
  'archived team is still visible to the coach');
select is((select count(*)::int from public.players), 2,
  'players of the archived team are still visible');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name)
    select id, 'X', 'Y' from ids where name = 'team_a'$$,
  '42501', null, 'archived team is read-only');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Feature flags
-- -----------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, coach_id) values ('staff.meeting', true, tests.id('a@test.local'));
insert into public.feature_flags (key, enabled, club_id)
select 'video.analysis', true, id from ids where name = 'club_c';
insert into public.feature_flags (key, enabled, coach_id) values ('video.analysis', false, tests.id('owner@test.local'));

select tests.login('a@test.local');
select ok(public.is_feature_enabled('staff.meeting'), 'coach flag is on for that coach');
select ok(not public.is_feature_enabled('video.analysis'), 'club flag does not leak to other coaches');
select throws_ok(
  $$insert into public.feature_flags (key, enabled, coach_id) values ('x', true, tests.id('a@test.local'))$$,
  '42501', null, 'users cannot set feature flags');
select tests.logout();

select tests.login('d@test.local');
select ok(public.is_feature_enabled('video.analysis'), 'club flag applies to the club''s head coach');
select ok(not public.is_feature_enabled('staff.meeting'), 'coach flag of someone else does not apply');
select tests.logout();

select tests.login('owner@test.local');
select ok(not public.is_feature_enabled('video.analysis'), 'coach-level flag overrides the club flag');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Storage: team logos
-- -----------------------------------------------------------------------------
select tests.login('b@test.local');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'team-logos', id || '/logo.png' from ids where name = 'team_b'$$,
  'head coach uploads a logo for own team');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'team-logos', id || '/logo.png' from ids where name = 'team_c1'$$,
  '42501', null, 'cannot upload a logo for another team');
select tests.logout();

select tests.login('d@test.local');
select is((select count(*)::int from storage.objects where bucket_id = 'team-logos'), 0,
  'cannot see logos of other teams');
select tests.logout();

select * from finish();
rollback;
