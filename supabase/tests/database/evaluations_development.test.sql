-- Evaluations and development: training evaluations, team goals with their
-- history, player goals only when switched on; the head coach writes, the T2
-- reads, another coach sees nothing.
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


select tests.create_user(e) from unnest(array['a@test.local', 'b@test.local', 't2@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()), ('player_a', gen_random_uuid()), ('player_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.players (id, team_id, first_name, last_name, shirt_number)
values ((select id from ids where name = 'player_a'), (select id from ids where name = 'team_a'), 'Jan', 'Peeters', 7),
       ((select id from ids where name = 'player_b'), (select id from ids where name = 'team_b'), 'Piet', 'Janssens', 9);
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok($$
  insert into public.training_evaluations (team_id, session_date, rating, went_well, attention_points)
  values ((select id from ids where name = 'team_a'), '2026-11-17', 4, 'Goede intensiteit', '{omschakeling,communicatie}') returning id$$,
  'the head coach evaluates a training (insert ... returning)');
select throws_ok($$
  insert into public.training_evaluations (team_id, session_date, rating) values ((select id from ids where name = 'team_a'), '2026-11-17', 3)$$,
  '23505', null, 'one evaluation per training day');
select throws_ok($$
  insert into public.training_evaluations (team_id, session_date, attention_points) values ((select id from ids where name = 'team_a'), '2026-11-18', '{"Geen Code"}')$$,
  '23514', null, 'attention points are codes');
with x as (
  insert into public.team_goals (team_id, title) values ((select id from ids where name = 'team_a'), 'Compacter verdedigen') returning id
) insert into ids select 'goal', id from x;
update public.team_goals set progress = 40, status = 'on_track' where id = (select id from ids where name = 'goal');
update public.team_goals set title = 'Compact verdedigen' where id = (select id from ids where name = 'goal');
select results_eq($$select status, progress::int from public.team_goal_updates order by id$$,
  $$values ('open', 0), ('on_track', 40)$$, 'the history keeps every change of status or progress');
select throws_ok($$
  insert into public.player_goals (team_id, player_id, title) values ((select id from ids where name = 'team_a'), (select id from ids where name = 'player_a'), 'Linksbenig')$$,
  '23514', 'player goals are off for this team', 'player goals only when switched on');
update public.teams set player_goals_enabled = true where id = (select id from ids where name = 'team_a');
select lives_ok($$
  insert into public.player_goals (team_id, player_id, title) values ((select id from ids where name = 'team_a'), (select id from ids where name = 'player_a'), 'Linksbenig') returning id$$,
  'switched on, the head coach adds a player goal');
select throws_ok($$
  insert into public.player_goals (team_id, player_id, title) values ((select id from ids where name = 'team_a'), (select id from ids where name = 'player_b'), 'X')$$,
  '23514', 'player is not in this team', 'only a player of the team');
select throws_ok($$insert into public.team_goal_updates (goal_id, team_id, status, progress)
  values ((select id from ids where name = 'goal'), (select id from ids where name = 'team_a'), 'open', 0)$$,
  '42501', null, 'the history is written only by the trigger');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.training_evaluations) + (select count(*)::int from public.team_goals)
  + (select count(*)::int from public.player_goals) + (select count(*)::int from public.team_goal_updates), 5, 'the T2 reads everything of the team');
select throws_ok($$insert into public.team_goals (team_id, title) values ((select id from ids where name = 'team_a'), 'X')$$,
  '42501', null, 'but does not write');
update public.training_evaluations set rating = 1;
select is((select rating::int from public.training_evaluations), 4, 'nor change an evaluation');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.training_evaluations) + (select count(*)::int from public.team_goals)
  + (select count(*)::int from public.player_goals), 0, 'another coach sees nothing');
select throws_ok($$insert into public.training_evaluations (team_id, session_date) values ((select id from ids where name = 'team_a'), '2026-11-19')$$,
  '42501', null, 'and writes nothing in another team');
select tests.logout();

select tests.login('a@test.local');
delete from public.team_goals where id = (select id from ids where name = 'goal');
select is((select count(*)::int from public.team_goal_updates), 0, 'deleting a goal removes its history');
select tests.logout();

select * from finish();
rollback;
