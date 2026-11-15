-- Conversations with the staff: the head coach writes, readers of the team read,
-- nobody changes or deletes a message, and real AI answers have a daily limit.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

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
insert into ids values ('team_a', gen_random_uuid()), ('team_old', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_old'), tests.id('a@test.local'), 'Oud', 'Club A';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.staff_messages (team_id, role, author, content)
    select id, 'assistant-coach', 'coach', 'Wat stel je voor donderdag voor?' from ids where name = 'team_a' returning id$$,
  'head coach writes a message (insert ... returning)');
select lives_ok(
  $$insert into public.staff_messages (team_id, role, author, content, task_proposal, provider)
    select id, 'assistant-coach', 'role', 'Drie oefeningen.', '{"titel": "T", "betrokken_rollen": ["physical-coach"], "opdracht": "O"}', 'example'
    from ids where name = 'team_a' returning id$$,
  'head coach stores the answer of the role (insert ... returning)');
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content) select id, 'Assistent Coach', 'coach', 'x' from ids where name = 'team_a'$$,
  '23514', null, 'the role is a role id');
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content) select id, 'assistant-coach', 'coach', '  ' from ids where name = 'team_a'$$,
  '23514', null, 'a message is not empty');
update public.staff_messages set content = 'gewijzigd';
delete from public.staff_messages;
select is((select count(*)::int from public.staff_messages where content <> 'gewijzigd'), 2, 'messages are never changed or deleted');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from public.staff_messages), 2, 'a T2 reads the conversations');
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content) select id, 'assistant-coach', 'coach', 'x' from ids where name = 'team_a'$$,
  '42501', null, 'a T2 does not write');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.staff_messages), 0, 'another coach sees nothing');
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content) select id, 'assistant-coach', 'coach', 'x' from ids where name = 'team_a'$$,
  '42501', null, 'another coach does not write');
select tests.logout();

-- Archived team: read-only.
update public.teams set archived_at = now() where id = (select id from ids where name = 'team_old');
select tests.login('a@test.local');
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content) select id, 'assistant-coach', 'coach', 'x' from ids where name = 'team_old'$$,
  '42501', null, 'no messages on an archived team');
select tests.logout();

-- Daily limit for real AI answers.
insert into public.staff_messages (team_id, role, author, content, provider, created_by)
select (select id from ids where name = 'team_a'), 'tactical-coach', 'role', 'Antwoord', 'anthropic', tests.id('a@test.local')
from generate_series(1, public.staff_chat_daily_limit());
select throws_ok(
  $$insert into public.staff_messages (team_id, role, author, content, provider, created_by)
    select id, 'tactical-coach', 'role', 'Eén te veel', 'anthropic', tests.id('a@test.local') from ids where name = 'team_a'$$,
  '23514', 'daily limit of staff messages reached', 'real AI answers have a daily limit');

select * from finish();
rollback;
