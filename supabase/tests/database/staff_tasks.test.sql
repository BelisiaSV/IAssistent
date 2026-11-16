-- Joint tasks: the head coach confirms a proposal of a role once and runs its
-- steps; readers of the team read; nobody deletes; real AI steps have a limit.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

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
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid()), ('msg_a', gen_random_uuid()),
  ('msg_coach', gen_random_uuid()), ('msg_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');
insert into public.staff_messages (id, team_id, role, author, content, task_proposal, provider, created_by)
select (select id from ids where name = 'msg_a'), (select id from ids where name = 'team_a'), 'assistant-coach', 'role', 'Drie oefeningen.',
       '{"titel": "T", "betrokken_rollen": ["physical-coach"], "opdracht": "O"}', 'example', tests.id('a@test.local');
insert into public.staff_messages (id, team_id, role, author, content, created_by)
select (select id from ids where name = 'msg_coach'), (select id from ids where name = 'team_a'), 'assistant-coach', 'coach', 'Vraag', tests.id('a@test.local');
insert into public.staff_messages (id, team_id, role, author, content, task_proposal, provider, created_by)
select (select id from ids where name = 'msg_b'), (select id from ids where name = 'team_b'), 'assistant-coach', 'role', 'Voorstel B',
       '{"titel": "T", "betrokken_rollen": ["physical-coach"], "opdracht": "O"}', 'example', tests.id('b@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.staff_tasks (team_id, source_message_id, owner_role, roles, title, assignment)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'msg_a'), 'assistant-coach', '{physical-coach}', 'T', 'O'
    returning id$$,
  'head coach confirms a proposal (insert ... returning)');
insert into ids select 'task_a', id from public.staff_tasks where source_message_id = (select id from ids where name = 'msg_a');
select throws_ok(
  $$insert into public.staff_tasks (team_id, source_message_id, owner_role, roles, title, assignment)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'msg_a'), 'assistant-coach', '{physical-coach}', 'T', 'O'$$,
  '23505', null, 'a proposal is confirmed only once');
select throws_ok(
  $$insert into public.staff_tasks (team_id, source_message_id, owner_role, roles, title, assignment)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'msg_coach'), 'assistant-coach', '{physical-coach}', 'T', 'O'$$,
  '23514', 'task does not come from a proposal of this team', 'only a proposal of a role becomes a task');
select throws_ok(
  $$insert into public.staff_tasks (team_id, source_message_id, owner_role, roles, title, assignment)
    select (select id from ids where name = 'team_a'), (select id from ids where name = 'msg_a'), 'tactical-coach', '{physical-coach}', 'T', 'O'$$,
  '23514', null, 'the owner is the role that proposed it');
select lives_ok(
  $$insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider)
    select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_a'), 1, 1, 'physical-coach', 'bijdrage', 'example'
    returning id$$,
  'head coach adds a step (insert ... returning)');
select lives_ok(
  $$update public.staff_task_steps set status = 'ready', output = '{"samenvatting": "S", "inhoud": "I", "aandachtspunten": []}'
    where task_id = (select id from ids where name = 'task_a')$$,
  'head coach stores the output of a step');
update public.staff_tasks set status = 'approved', decided_at = now() where id = (select id from ids where name = 'task_a');
select is((select status from public.staff_tasks where id = (select id from ids where name = 'task_a')), 'approved', 'head coach approves a task');
delete from public.staff_task_steps;
delete from public.staff_tasks;
select is((select count(*)::int from public.staff_tasks), 1, 'tasks are never deleted');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.staff_task_steps), 1, 'a T2 reads the steps');
select throws_ok(
  $$insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider)
    select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_a'), 2, 1, 'physical-coach', 'bijdrage', 'example'$$,
  '42501', null, 'a T2 does not write');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.staff_tasks), 0, 'another coach sees no tasks of team A');
select throws_ok(
  $$insert into public.staff_tasks (team_id, source_message_id, owner_role, roles, title, assignment)
    select (select id from ids where name = 'team_b'), (select id from ids where name = 'msg_a'), 'assistant-coach', '{physical-coach}', 'T', 'O'$$,
  '23514', null, 'no task from a message of another team');
select throws_ok(
  $$insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider)
    select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_b'), 3, 1, 'physical-coach', 'bijdrage', 'example'$$,
  '23514', 'step does not belong to a task of this team', 'no steps on a task of another team');
select tests.logout();

-- Archived team: read-only.
update public.teams set archived_at = now() where id = (select id from ids where name = 'team_a');
select tests.login('a@test.local');
select throws_ok(
  $$insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider)
    select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_a'), 2, 1, 'physical-coach', 'bijdrage', 'example'$$,
  '42501', null, 'no steps on an archived team');
select tests.logout();
update public.teams set archived_at = null where id = (select id from ids where name = 'team_a');

-- Daily limit for real AI steps.
insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider, created_by)
select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_a'), 10, g, 'physical-coach', 'bijdrage', 'anthropic', tests.id('a@test.local')
from generate_series(1, public.staff_task_daily_limit()) g;
select throws_ok(
  $$insert into public.staff_task_steps (task_id, team_id, version, position, role, phase, provider, created_by)
    select (select id from ids where name = 'task_a'), (select id from ids where name = 'team_a'), 11, 1, 'physical-coach', 'bijdrage', 'anthropic', tests.id('a@test.local')$$,
  '23514', 'daily limit of staff task steps reached', 'real AI steps have a daily limit');

select * from finish();
rollback;
