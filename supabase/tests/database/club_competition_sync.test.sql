-- A coach brings his team into a club with its team in the export: on approval
-- the team is linked to the competition and its matches and scores are there
-- at once. Linking by the admin syncs too; a coach never sets the link himself.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

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

select tests.create_user(e) from unnest(array['owner@test.local', 'coach@test.local', 'other@test.local', 'admin@test.local']) e;
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('team', gen_random_uuid()), ('team2', gen_random_uuid());

insert into public.clubs (id, name, created_by, federation_number)
select id, 'Club X', tests.id('owner@test.local'), '1234' from ids where name = 'club';
insert into public.club_subscriptions (club_id, license_seats) select id, 5 from ids where name = 'club';
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['owner@test.local', 'coach@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, case l.coach_id when tests.id('owner@test.local') then 'owner' else 'coach' end::public.club_role, l.id
from public.club_licenses l;

insert into public.federation_clubs (number, name, teams) values
  ('1234', 'Club X', '[{"name": "Club X A", "divisions": ["1"]}, {"name": "Club X B", "divisions": ["3B"]}]');

-- Next Saturday (a week ahead) and a played match a week ago.
create temp table dates as
select (date_trunc('week', current_date)::date + 12) as next_match, (current_date - 7) as last_match;
grant select on dates to authenticated;
insert into public.competition_matches (division, match_date, kickoff, home, away, home_goals, away_goals)
select '1', next_match, '20:00', 'Club X A', 'Rivaal', null, null from dates
union all select '1', last_match, '15:00', 'Andere', 'Club X A', 1, 3 from dates
union all select '3B', next_match, '15:00', 'Club X B', 'Derde', null, null from dates;

insert into public.teams (id, head_coach_id, name, club_name, training_schedule)
select id, tests.id('coach@test.local'), 'Mijn ploeg', 'Club X', '[{"weekday": 2, "start": "19:30", "duration_min": 90}]'
from ids where name = 'team';
insert into public.teams (id, head_coach_id, name, club_name)
select id, tests.id('other@test.local'), 'B-ploeg', 'Club X' from ids where name = 'team2';

-- The coach sees the teams of his club in the export, an outsider not
select tests.login('coach@test.local');
select results_eq($$select name, divisions from public.club_federation_teams((select id from ids where name = 'club'))$$,
  $$values ('Club X A', '{1}'::text[]), ('Club X B', '{3B}'::text[])$$, 'a coach of the club sees its teams in the export');
select is((select count(*)::int from public.competition_matches), 0, 'no competition data before the link');
select throws_ok($$select public.request_club_team_link((select id from ids where name = 'team'), (select id from ids where name = 'club'), 'Andere')$$,
  '23514', 'not a team of this club in the export', 'only a team of the club can be chosen');
insert into ids select 'link', public.request_club_team_link((select id from ids where name = 'team'), (select id from ids where name = 'club'), 'Club X A');
select is((select federation_team from public.club_team_links where id = (select id from ids where name = 'link')), 'Club X A',
  'the request keeps the chosen team');
select tests.logout();

select tests.login('other@test.local');
select throws_ok($$select * from public.club_federation_teams((select id from ids where name = 'club'))$$,
  '42501', null, 'someone outside the club does not see its teams');
select tests.logout();

-- The owner approves: the team is linked and everything is there
select tests.login('owner@test.local');
select lives_ok($$select public.decide_club_team_link((select id from ids where name = 'link'), true)$$, 'the owner approves');
select tests.logout();

select results_eq($$select federation_team, federation_divisions from public.teams where id = (select id from ids where name = 'team')$$,
  $$values ('Club X A', '{1}'::text[])$$, 'the team is linked to its team and divisions');

select tests.login('coach@test.local');
select is((select count(*)::int from public.competition_matches), 2, 'the coach reads the matches of his division');
select is(
  (select (w.matches -> 0 ->> 'opponent') from public.week_plans w, dates d
   where w.team_id = (select id from ids where name = 'team') and w.week_start = d.next_match - 5),
  'Rivaal', 'the next match is in the week input');
select is(
  (select jsonb_array_length(w.trainings) from public.week_plans w, dates d
   where w.team_id = (select id from ids where name = 'team') and w.week_start = d.next_match - 5),
  1, 'with the fixed training days');
select results_eq(
  $$select goals_for::int, goals_against::int, home from public.match_reports where team_id = (select id from ids where name = 'team')$$,
  $$values (3, 1, false)$$, 'the score of the played match is in the match reports');
select throws_ok($$update public.teams set federation_team = 'Club X B' where id = (select id from ids where name = 'team')$$,
  '42501', null, 'the coach cannot change the link himself');
select tests.logout();

-- Linked by the admin: synced too
select tests.login('admin@test.local');
select lives_ok($$select public.admin_set_team_competition((select id from ids where name = 'team2'), 'Club X B', '{3B}')$$,
  'the admin links another team');
select tests.logout();
select is((select count(*)::int from public.week_plans where team_id = (select id from ids where name = 'team2')), 1,
  'its match is in the week input at once');

select * from finish();
rollback;
