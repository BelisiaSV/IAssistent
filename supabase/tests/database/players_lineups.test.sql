-- Players (phase 2a fields) and lineups: RLS and business rules.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- Helpers -----------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

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
grant execute on all functions in schema tests to anon, authenticated;

-- Fixtures ----------------------------------------------------------------------
select tests.create_user('a@test.local');
select tests.create_user('b@test.local');
select tests.create_user('t2@test.local');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()),
  ('gk', gen_random_uuid()), ('st', gen_random_uuid()), ('b_player', gen_random_uuid());

insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';

insert into public.players (id, team_id, first_name, last_name, shirt_number, primary_position)
select (select id from ids where name = 'gk'), (select id from ids where name = 'team_a'), 'Keeper', 'A', 1, 'GK';
insert into public.players (id, team_id, first_name, last_name, shirt_number, primary_position)
select (select id from ids where name = 'st'), (select id from ids where name = 'team_a'), 'Spits', 'A', 9, 'ST';
insert into public.players (id, team_id, first_name, last_name)
select (select id from ids where name = 'b_player'), (select id from ids where name = 'team_b'), 'Speler', 'B';

insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

-- Players -----------------------------------------------------------------------
select tests.login('a@test.local');

select lives_ok(
  $$insert into public.players
      (team_id, first_name, last_name, shirt_number, primary_position, secondary_positions,
       preferred_foot, birth_year, joined_club_year, status, expected_return_date)
    select id, 'Nieuwe', 'Speler', 7, 'RM', '{RW,RB}', 'right', 2001, 2022, 'injured', current_date + 14
    from ids where name = 'team_a'
    returning id$$,
  'head coach adds a player with all new fields (insert ... returning)');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name, primary_position)
    select id, 'X', 'Y', 'Spits' from ids where name = 'team_a'$$,
  '23514', null, 'primary_position must be a position code');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name, joined_club_year)
    select id, 'X', 'Y', 1800 from ids where name = 'team_a'$$,
  '23514', null, 'joined_club_year must be plausible');
select throws_ok(
  $$insert into public.players (team_id, first_name, last_name, shirt_number)
    select id, 'X', 'Y', 9 from ids where name = 'team_a'$$,
  '23505', null, 'shirt number is unique within the active squad');
select lives_ok(
  $$update public.players set archived_at = now() where shirt_number = 9$$,
  'head coach archives a player');
select lives_ok(
  $$insert into public.players (team_id, first_name, last_name, shirt_number)
    select id, 'Nieuwe', 'Negen', 9 from ids where name = 'team_a'$$,
  'archived player frees the shirt number');
update public.players set archived_at = null, shirt_number = 99 where shirt_number = 9 and archived_at is not null;

-- Lineups -----------------------------------------------------------------------
select lives_ok(
  $$insert into public.lineups (team_id, title, formation, starters, bench)
    select (select id from ids where name = 'team_a'), 'Speeldag 1', '4-4-2',
           jsonb_build_object('GK', (select id from ids where name = 'gk')),
           array[(select id from ids where name = 'st')]
    returning id$$,
  'head coach creates a lineup (insert ... returning)');
select throws_ok(
  $$insert into public.lineups (team_id, title, formation, starters)
    select (select id from ids where name = 'team_a'), 'X', '4-4-2',
           jsonb_build_object('GK', (select id from ids where name = 'b_player'))$$,
  '23514', 'lineup contains players of another team', 'players of another team are rejected');
select throws_ok(
  $$insert into public.lineups (team_id, title, formation, starters, bench)
    select (select id from ids where name = 'team_a'), 'X', '4-4-2',
           jsonb_build_object('GK', (select id from ids where name = 'gk')),
           array[(select id from ids where name = 'gk')]$$,
  '23514', 'a player can only appear once in a lineup', 'a player appears only once');
select throws_ok(
  $$insert into public.lineups (team_id, title, formation, starters)
    select (select id from ids where name = 'team_a'), 'X', '4-4-2', '{"GK": 5}'::jsonb$$,
  '23514', 'lineup starters must map slot ids to player ids', 'starters must be player ids');
select throws_ok(
  $$insert into public.lineups (team_id, title, formation)
    select id, 'X', '4-4-2' from ids where name = 'team_b'$$,
  '42501', null, 'cannot create a lineup for another team');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.lineups), 0, 'other coach does not see the lineup');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.lineups), 1, 'T2 sees the lineup');
select throws_ok(
  $$insert into public.lineups (team_id, title, formation)
    select id, 'X', '4-4-2' from ids where name = 'team_a'$$,
  '42501', null, 'T2 cannot create lineups');
select tests.logout();

select tests.login('a@test.local');
update public.teams set archived_at = now() where name = 'A';
select is((select count(*)::int from public.lineups), 1, 'lineups of an archived team stay readable');
update public.lineups set title = 'Nieuw';
select is((select title from public.lineups), 'Speeldag 1', 'lineups of an archived team are read-only');
select tests.logout();

-- Seed ------------------------------------------------------------------------
select ok(
  (select count(*) from public.players
   where team_id = '22222222-2222-4222-8222-222222222222' and primary_position is not null) >= 11,
  'seed squad has at least 11 players with a position');

select * from finish();
rollback;
