-- Exercise library: own exercises only, video storage per coach.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select tests.login('a@test.local');
select lives_ok(
  $$insert into public.exercises (title, phase, labels, min_players, max_players, course)
    values ('Rondo 5v2', 'opwarming', '{rondo,balbezit}', 7, 7, '{"Max. 2 balcontacten"}') returning id$$,
  'coach creates an exercise (insert ... returning)');
insert into ids select 'ex_a', id from public.exercises where title = 'Rondo 5v2';
select is((select coach_id from public.exercises where title = 'Rondo 5v2'), tests.id('a@test.local'), 'the exercise belongs to the coach');
select throws_ok(
  $$insert into public.exercises (title, min_players, max_players) values ('X', 10, 4)$$,
  '23514', null, 'min players cannot exceed max players');
select throws_ok(
  $$insert into public.exercises (coach_id, title) values (tests.id('b@test.local'), 'Voor B')$$,
  '42501', null, 'cannot create an exercise for another coach');
select lives_ok(
  $$update public.exercises set animation = '{"titel": "Rondo"}', video_path = tests.id('a@test.local') || '/' || (select id from ids where name = 'ex_a') || '/rondo.mp4'
    where id = (select id from ids where name = 'ex_a')$$,
  'coach adds an animation and a video');
select throws_ok(
  $$update public.exercises set video_path = 'iemand/anders.mp4' where id = (select id from ids where name = 'ex_a')$$,
  '23514', null, 'video path must be in the folder of the coach and exercise');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('exercise-videos', tests.id('a@test.local') || '/x/rondo.mp4')$$,
  'coach uploads a video in own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('exercise-videos', tests.id('b@test.local') || '/x/rondo.mp4')$$,
  '42501', null, 'cannot upload in the folder of another coach');
select lives_ok(
  $$update public.teams set animation_settings = '{"stijl": "donker"}' where false$$,
  'teams have animation settings');
select tests.logout();

select tests.login('b@test.local');
select is((select count(*)::int from public.exercises), 0, 'other coach does not see the exercises');
select is((select count(*)::int from storage.objects where bucket_id = 'exercise-videos'), 0, 'other coach does not see the videos');
select lives_ok($$update public.exercises set title = 'Gestolen'$$, 'update on others runs but changes nothing');
select tests.logout();
select is((select title from public.exercises where id = (select id from ids where name = 'ex_a')), 'Rondo 5v2', 'title unchanged');

select * from finish();
rollback;
