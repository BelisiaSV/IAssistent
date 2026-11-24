-- Club environment: subscriptions, activation codes, licences, roles, team
-- staff, linking a personal team, and strict separation between clubs.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(63);

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

select tests.create_user(e) from unnest(array[
  'admin@test.local',    -- platform admin
  'owner@test.local',    -- owner of club X
  'cadmin@test.local',   -- club admin of X
  'td@test.local',       -- technical director of X
  'coord@test.local',    -- team coordinator of X
  'coach1@test.local',   -- coach of X, head coach of club team X1
  'coach2@test.local',   -- has a personal team P, joins X and links P
  'ownery@test.local',   -- owner of club Y
  'guesser@test.local'   -- tries codes
]) e;
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table codes (name text primary key, id uuid, code text) on commit drop;
grant all on ids, codes to authenticated;

insert into ids values ('team_p', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select id, tests.id('coach2@test.local'), 'Team P', 'Eigen club' from ids where name = 'team_p';
insert into public.players (team_id, first_name, last_name)
select id, 'Speler', 'P' from ids where name = 'team_p';

-- -----------------------------------------------------------------------------
-- Platform admin creates the clubs
-- -----------------------------------------------------------------------------
select tests.login('owner@test.local');
select throws_ok($$select public.admin_create_club('Eigen club')$$, '42501', null,
  'a coach cannot create a club');
select tests.logout();

select tests.login('admin@test.local');
insert into ids select 'club_x', public.admin_create_club('Club X');
insert into ids select 'club_y', public.admin_create_club('Club Y');
select ok(not public.club_is_active((select id from ids where name = 'club_x')),
  'a new club is inactive until it has a subscription');
select throws_ok(
  $$select * from public.create_club_activation_code((select id from ids where name = 'club_x'), 'owner')$$,
  '23514', 'club is not active', 'no codes for an inactive club');
select lives_ok($$select public.admin_set_club_subscription((select id from ids where name = 'club_x'),
  (select id from public.plans where code = 'club-start'), 2, 2, null, current_date, null)$$,
  'the admin sets the subscription of club X');
select public.admin_set_club_subscription((select id from ids where name = 'club_y'),
  null, 2, null, '{dna}', current_date, null);
select is((select modules from public.club_subscriptions where club_id = (select id from ids where name = 'club_x')),
  '{dna,exercises}'::text[], 'modules default to the plan''s modules');
insert into codes select 'owner_x', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'owner') c;
insert into codes select 'owner_y', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_y'), 'owner') c;
select matches((select code from codes where name = 'owner_x'), '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$',
  'a code is 12 characters in three groups');
select tests.logout();

select ok(not exists (
  select 1 from public.club_activation_codes c join codes on codes.id = c.id
  where c.code_hash like '%' || replace(codes.code, '-', '') || '%'
), 'the readable code is not stored');

select tests.login('owner@test.local');
select throws_ok($$select public.admin_set_club_subscription((select id from ids where name = 'club_x'),
  null, 99, null, null, current_date, null)$$, '42501', null, 'a club owner cannot change the subscription');
select is((select count(*)::int from public.clubs), 0, 'before redeeming, a coach sees no club');
select is(public.redeem_club_activation_code(lower((select code from codes where name = 'owner_x'))) ->> 'ok', 'true',
  'the owner redeems the code (case and dashes do not matter)');
select is((select role::text from public.club_members where coach_id = tests.id('owner@test.local')), 'owner',
  'the owner is a member of club X');
select is((select count(*)::int from public.club_licenses where coach_id = tests.id('owner@test.local') and status = 'active'), 1,
  'the owner uses a licence');
select results_eq('select name from public.clubs', $$values ('Club X')$$, 'the owner sees club X only');
select is(public.redeem_club_activation_code((select code from codes where name = 'owner_x')) ->> 'error', 'invalid',
  'a code works only once');
select throws_ok($$select code_hash from public.club_activation_codes$$, '42501', null,
  'the hash of a code is never readable');
select ok(public.club_has_module((select id from ids where name = 'club_x'), 'dna'), 'club X has the DNA module');
select ok(not public.club_has_module((select id from ids where name = 'club_x'), 'planning'), 'club X has no planning module');

-- Teams and codes
insert into ids select 'team_x1', public.create_club_team((select id from ids where name = 'club_x'), 'X1', 'Club X', 'u17');
insert into codes select 'cadmin', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'admin') c;
insert into codes select 'td', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'technical_director') c;
select throws_ok(
  $$select * from public.create_club_activation_code((select id from ids where name = 'club_x'), 'coach')$$,
  '23514', 'no free licence seats', 'codes cannot exceed the licence seats (owner + open TD code + ...)');
select tests.logout();

select tests.login('admin@test.local');
select public.admin_set_club_subscription((select id from ids where name = 'club_x'),
  (select id from public.plans where code = 'club-start'), 5, 2, null, current_date, null);
select tests.logout();

select tests.login('cadmin@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'cadmin')) ->> 'ok', 'true',
  'the club admin joins');
select is((select count(*)::int from public.club_licenses where coach_id = tests.id('cadmin@test.local')), 0,
  'a club admin does not use a licence');
select ok(public.has_club_role((select id from ids where name = 'club_x'), '{owner}'),
  'a club admin is a club manager, like the owner');
insert into codes select 'coach1', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'coach', null,
    (select id from ids where name = 'team_x1'), 'head_coach') c;
insert into codes select 'coach2', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'coach') c;
insert into codes select 'coord', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'team_coordinator') c;
insert into codes select 'spare', c.id, c.code
  from public.create_club_activation_code((select id from ids where name = 'club_x'), 'assistant_coach',
    now() + interval '1 day') c;
select is(public.club_seats_used((select id from ids where name = 'club_x')), 5,
  'seats used = active licences + open codes that need one');
select lives_ok($$select public.revoke_club_activation_code((select id from codes where name = 'spare'))$$,
  'an open code can be revoked');
select is(public.club_seats_used((select id from ids where name = 'club_x')), 4, 'a revoked code frees its seat');
select throws_ok($$select public.revoke_club_activation_code((select id from codes where name = 'spare'))$$,
  '23514', 'code is not open', 'a revoked code cannot be revoked again');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Coaches join
-- -----------------------------------------------------------------------------
select tests.login('coach1@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'spare')) ->> 'error', 'invalid',
  'a revoked code does not work');
select is(public.redeem_club_activation_code((select code from codes where name = 'coach1')) ->> 'ok', 'true',
  'coach 1 joins');
select ok(public.can_write_team((select id from ids where name = 'team_x1')),
  'the code made coach 1 head coach of X1');
select lives_ok($$insert into public.players (team_id, first_name, last_name)
  select id, 'Speler', 'X1' from ids where name = 'team_x1'$$, 'the head coach adds a player to the club team');
select is((select count(*)::int from public.club_audit_log), 0, 'a coach cannot read the audit log');
select is((select count(*)::int from public.club_members), 1, 'a coach sees only his own club roles');
select tests.logout();

select tests.login('td@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'td')) ->> 'ok', 'true', 'the TD joins');
select is((select count(*)::int from public.players), 1, 'the TD reads the players of the club teams');
select throws_ok($$insert into public.players (team_id, first_name, last_name)
  select id, 'X', 'Y' from ids where name = 'team_x1'$$, '42501', null, 'the TD cannot write team data');
select tests.logout();

-- An expired code
update public.club_activation_codes set expires_at = now() - interval '1 minute'
  where id = (select id from codes where name = 'coord');
select tests.login('coord@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'coord')) ->> 'error', 'expired',
  'an expired code does not work');
select tests.logout();
update public.club_activation_codes set expires_at = null where id = (select id from codes where name = 'coord');
select tests.login('coord@test.local');
select public.redeem_club_activation_code((select code from codes where name = 'coord'));
select is((select count(*)::int from public.teams), 0, 'a coordinator without teams sees no team');
select tests.logout();

select tests.login('cadmin@test.local');
select throws_ok($$select public.assign_team_staff((select id from ids where name = 'team_x1'), tests.id('coord@test.local'), 'head_coach')$$,
  '23514', 'person has no fitting role in the club', 'a coordinator cannot be made head coach');
select lives_ok($$select public.assign_team_staff((select id from ids where name = 'team_x1'), tests.id('coord@test.local'), 'coordinator')$$,
  'the club admin assigns the coordinator to X1');
select tests.logout();

select tests.login('coord@test.local');
select results_eq('select name from public.teams', $$values ('X1')$$, 'the coordinator sees his team');
select ok(not public.can_write_team((select id from ids where name = 'team_x1')), 'the coordinator cannot write');
select tests.logout();

-- -----------------------------------------------------------------------------
-- A coach links his personal team
-- -----------------------------------------------------------------------------
select tests.login('coach2@test.local');
select throws_ok($$select public.request_club_team_link((select id from ids where name = 'team_p'), (select id from ids where name = 'club_x'))$$,
  '42501', null, 'only a coach of the club can link a team');
select public.redeem_club_activation_code((select code from codes where name = 'coach2'));
select throws_ok($$update public.teams set club_id = (select id from ids where name = 'club_x') where name = 'Team P'$$,
  '23514', 'head_coach_id and club_id of a team cannot be changed', 'a coach cannot move a team into a club himself');
insert into ids select 'link_p', public.request_club_team_link((select id from ids where name = 'team_p'), (select id from ids where name = 'club_x'));
select throws_ok($$select public.decide_club_team_link((select id from ids where name = 'link_p'), true)$$,
  '42501', null, 'a coach cannot approve his own request');
select tests.logout();

select tests.login('owner@test.local');
select lives_ok($$select public.decide_club_team_link((select id from ids where name = 'link_p'), true)$$,
  'the owner approves the link');
select is((select count(*)::int from public.players p join ids on ids.id = p.team_id and ids.name = 'team_p'), 1,
  'the owner reads the players of the linked team');
select throws_ok($$select public.create_club_team((select id from ids where name = 'club_x'), 'X3', 'Club X')$$,
  '23514', 'club has no free team places', 'linked teams count for the max. teams');
select tests.logout();

select tests.login('coach2@test.local');
select ok(public.can_write_team((select id from ids where name = 'team_p')), 'coach 2 still coaches team P in the club');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Club Y sees nothing of club X
-- -----------------------------------------------------------------------------
select tests.login('ownery@test.local');
select public.redeem_club_activation_code((select code from codes where name = 'owner_y'));
select results_eq('select name from public.clubs', $$values ('Club Y')$$, 'owner Y sees club Y only');
select is((select count(*)::int from public.teams), 0, 'owner Y sees no team of club X');
select is((select count(*)::int from public.players), 0, 'owner Y sees no player of club X');
select is((select count(*)::int from public.club_members where club_id = (select id from ids where name = 'club_x')), 0,
  'owner Y sees no members of club X');
select is((select count(*)::int from public.club_activation_codes where club_id = (select id from ids where name = 'club_x')), 0,
  'owner Y sees no codes of club X');
select throws_ok($$select public.assign_team_staff((select id from ids where name = 'team_x1'), tests.id('ownery@test.local'), 'head_coach')$$,
  '42501', null, 'owner Y cannot manage the staff of club X');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Revoking a licence
-- -----------------------------------------------------------------------------
select tests.login('cadmin@test.local');
select ok(public.has_club_role((select id from ids where name = 'club_x'), '{owner}'),
  'a club admin manages licences like the owner');
select lives_ok($$select public.revoke_club_license((select id from public.club_licenses where coach_id = tests.id('coach1@test.local')))$$,
  'the club admin revokes the licence of coach 1');
select ok(exists (select 1 from public.club_audit_log where action = 'license.revoked'), 'the revocation is in the audit log');
select tests.logout();

select tests.login('coach1@test.local');
select is((select count(*)::int from public.teams), 0, 'without licence, coach 1 no longer sees the club team');
select is((select count(*)::int from public.clubs), 0, 'without licence, coach 1 no longer sees the club');
select tests.logout();

select tests.login('owner@test.local');
select is((select count(*)::int from public.players p join ids on ids.id = p.team_id and ids.name = 'team_x1'), 1,
  'the club keeps the history of the team');
select ok((select count(*) from public.team_staff where coach_id = tests.id('coach1@test.local') and ended_at is not null) = 1,
  'the staff row of coach 1 is ended, not deleted');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Too many wrong codes
-- -----------------------------------------------------------------------------
select tests.login('guesser@test.local');
select public.redeem_club_activation_code('AAAA-AAAA-AAA' || n) from generate_series(1, 10) n;
select is(public.redeem_club_activation_code((select code from codes where name = 'owner_x')) ->> 'error', 'too_many_attempts',
  'after 10 wrong codes in an hour, redeeming stops');
select tests.logout();

-- -----------------------------------------------------------------------------
-- An ended subscription
-- -----------------------------------------------------------------------------
update public.club_subscriptions set starts_on = current_date - 30, ends_on = current_date - 1
  where club_id = (select id from ids where name = 'club_x');
select tests.login('owner@test.local');
select ok(not public.club_has_module((select id from ids where name = 'club_x'), 'dna'), 'an ended subscription has no modules');
select throws_ok($$select * from public.create_club_activation_code((select id from ids where name = 'club_x'), 'coach')$$,
  '23514', 'club is not active', 'no new codes after the subscription ended');
select tests.logout();

select * from finish();
rollback;
