-- Presentation media: opponent logos and team photos in the private bucket
-- team-media, written by the head coach, read by whoever can read the team.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

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
insert into ids values ('team_a', gen_random_uuid()), ('team_b', gen_random_uuid());
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_a'), tests.id('a@test.local'), 'A', 'Club A';
insert into public.teams (id, head_coach_id, name, club_name)
select (select id from ids where name = 'team_b'), tests.id('b@test.local'), 'B', 'Club B';
insert into public.memberships (coach_id, role, team_id, valid_until, granted_by)
select tests.id('t2@test.local'), 'assistant_coach', (select id from ids where name = 'team_a'),
       now() + interval '7 days', tests.id('a@test.local');

select tests.login('a@test.local');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) select 'team-media', id || '/opponents/x.png' from ids where name = 'team_a'$$,
  'head coach uploads an opponent logo');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) select 'team-media', id || '/cover.jpg' from ids where name = 'team_b'$$,
  '42501', null, 'not for another team');
select lives_ok(
  $$insert into public.opponents (team_id, name, logo_path) select id, 'Tegenstander', id || '/opponents/x.png' from ids where name = 'team_a' returning id$$,
  'an opponent keeps its logo (insert ... returning)');
update public.teams set cover_photo_path = 'p/cover.jpg', team_photo_path = 'p/team.jpg' where id = (select id from ids where name = 'team_a');
select is((select cover_photo_path || ' ' || team_photo_path from public.teams where id = (select id from ids where name = 'team_a')), 'p/cover.jpg p/team.jpg',
  'head coach sets the photos of the team');
select tests.logout();

select tests.login('t2@test.local');
select is((select count(*)::int from storage.objects where bucket_id = 'team-media'), 1, 'a T2 sees the media');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) select 'team-media', id || '/team.jpg' from ids where name = 'team_a'$$,
  '42501', null, 'a T2 does not upload');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from storage.objects where bucket_id = 'team-media'), 0, 'another coach sees nothing');
select tests.logout();

select * from finish();
rollback;
