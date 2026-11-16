-- Cards and suspension rules, and staff meetings: the head coach writes,
-- readers of the team read, nobody deletes a meeting, real AI turns have a limit.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

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
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()), ('p_a', gen_random_uuid()), ('p_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');
insert into public.players (id, team_id, first_name, last_name, shirt_number, primary_position)
select (select id from ids where name = 'p_a'), (select id from ids where name = 'team_a'), 'Jan', 'A', 8, 'CM';
insert into public.players (id, team_id, first_name, last_name, shirt_number, primary_position)
select (select id from ids where name = 'p_b'), (select id from ids where name = 'team_b'), 'Piet', 'B', 8, 'CM';

-- Cards
select tests.login('a@test.local');
select is((select yellow_card_limit || '/' || yellow_card_ban || '/' || red_card_ban from public.teams where id = (select id from ids where name = 'team_a')),
  '5/1/1', 'a team has default suspension rules');
update public.teams set yellow_card_limit = 4 where id = (select id from ids where name = 'team_a');
select is((select yellow_card_limit from public.teams where id = (select id from ids where name = 'team_a')), 4, 'head coach sets the suspension rules');
select lives_ok(
  $$insert into public.player_cards (team_id, player_id, match_date, card)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_a'), '2026-11-14', 'yellow' returning id$$,
  'head coach records a card (insert ... returning)');
select throws_ok(
  $$insert into public.player_cards (team_id, player_id, match_date, card)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_b'), '2026-11-14', 'yellow'$$,
  '23514', 'player does not belong to the team', 'only players of the own team get cards');
select throws_ok(
  $$insert into public.player_cards (team_id, player_id, match_date, card)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'p_a'), '2026-11-14', 'blue'$$,
  '23514', null, 'a card is yellow or red');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.player_cards), 1, 'a T2 reads the cards');
delete from public.player_cards;
select tests.logout();
select is((select count(*)::int from public.player_cards), 1, 'a T2 does not delete cards');

select tests.login('b@test.local');
select is((select count(*)::int from public.player_cards), 0, 'another coach sees no cards of team A');
select tests.logout();

-- Meetings
select tests.login('a@test.local');
select lives_ok(
  $$insert into public.staff_meetings (team_id, assignment) select id, 'Omschakeling vanuit medium blok' from ids where name = 'team_a' returning id$$,
  'head coach starts a meeting (insert ... returning)');
insert into ids select 'm_a', id from public.staff_meetings;
select lives_ok(
  $$insert into public.staff_meeting_turns (meeting_id, team_id, version, position, role, kind, provider)
    select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_a'), 1, 1, 'coordinator', 'opening', 'example'
    returning id$$,
  'head coach adds a turn (insert ... returning)');
select throws_ok(
  $$insert into public.staff_meeting_turns (meeting_id, team_id, version, position, role, kind, provider)
    select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_a'), 1, 2, 'coordinator', 'toespraak', 'example'$$,
  '23514', null, 'the kind of a turn is known');
delete from public.staff_meetings;
select is((select count(*)::int from public.staff_meetings), 1, 'meetings are never deleted');
select tests.logout();

select tests.login('t2@test.local');
select throws_ok(
  $$insert into public.staff_meetings (team_id, assignment) select id, 'x' from ids where name = 'team_a'$$,
  '42501', null, 'a T2 does not start meetings');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.staff_meetings), 0, 'another coach sees no meetings of team A');
select throws_ok(
  $$insert into public.staff_meeting_turns (meeting_id, team_id, version, position, role, kind, provider)
    select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_b'), 1, 9, 'coordinator', 'opening', 'example'$$,
  '23514', 'turn does not belong to a meeting of this team', 'no turns on a meeting of another team');
select tests.logout();

insert into public.staff_meeting_turns (meeting_id, team_id, version, position, role, kind, provider, created_by)
select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_a'), 50, g, 'tactical-coach', 'bijdrage', 'anthropic', tests.id('a@test.local')
from generate_series(1, public.staff_meeting_daily_limit()) g;
select throws_ok(
  $$insert into public.staff_meeting_turns (meeting_id, team_id, version, position, role, kind, provider, created_by)
    select (select id from ids where name = 'm_a'), (select id from ids where name = 'team_a'), 51, 1, 'tactical-coach', 'bijdrage', 'anthropic', tests.id('a@test.local')$$,
  '23514', 'daily limit of staff meeting turns reached', 'real AI turns have a daily limit');

select * from finish();
rollback;
