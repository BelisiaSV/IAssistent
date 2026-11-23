-- Knowledge and collaboration: documents (managers add, members read),
-- shared trainings (head coach of a club team shares, TD marks examples,
-- nothing else changes), comments (members), other clubs see nothing.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

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

select tests.create_user(e) from unnest(array['owner@test.local', 'td@test.local', 'coach@test.local', 'coach2@test.local', 'other@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('club_y', gen_random_uuid());
insert into public.clubs (id, name, created_by) select id, name, tests.id('owner@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, max_teams, modules)
  select id, 10, 5, case when name = 'club' then '{knowledge}'::text[] else '{}'::text[] end from ids;
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['owner@test.local', 'td@test.local', 'coach@test.local', 'coach2@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, (case l.coach_id when tests.id('owner@test.local') then 'owner' when tests.id('td@test.local') then 'technical_director' else 'coach' end)::public.club_role, l.id
from public.club_licenses l;
insert into public.club_licenses (club_id, coach_id) select id, tests.id('other@test.local') from ids where name = 'club_y';
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l where l.coach_id = tests.id('other@test.local');

select tests.login('owner@test.local');
insert into ids select 'team', public.create_club_team((select id from ids where name = 'club'), 'A-ploeg', null);
select public.assign_team_staff((select id from ids where name = 'team'), tests.id('coach@test.local'), 'head_coach');
select tests.logout();

-- Documents
select tests.login('td@test.local');
select lives_ok($$
  insert into public.club_documents (club_id, title, kind, file_path, file_name)
  select id, 'Speelwijze', 'guideline', id || '/doc1/speelwijze.pdf', 'speelwijze.pdf' from ids where name = 'club' returning id$$,
  'the TD adds a guideline (insert ... returning)');
select throws_ok($$
  insert into public.club_documents (club_id, title, file_path, file_name)
  select id, 'X', 'ander/pad.pdf', 'pad.pdf' from ids where name = 'club'$$,
  '23514', null, 'the file lies in the club''s folder');
select tests.logout();

select tests.login('coach2@test.local');
select is((select count(*)::int from public.club_documents), 1, 'a coach of the club reads the documents');
select throws_ok($$
  insert into public.club_documents (club_id, title, file_path, file_name, uploaded_by)
  select id, 'X', id || '/x/x.pdf', 'x.pdf', tests.id('coach2@test.local') from ids where name = 'club'$$,
  '42501', null, 'but does not add them');
select tests.logout();

-- Shared trainings
select tests.login('coach@test.local');
select lives_ok($$
  insert into public.club_shared_trainings (club_id, team_id, session_date, title, age_category, content)
  values ((select id from ids where name = 'club'), (select id from ids where name = 'team'), '2026-11-17', 'Positiespel', 'senioren', '{"onderdelen": []}')
  returning id$$, 'the head coach of a club team shares a training (insert ... returning)');
insert into ids select 'training', id from public.club_shared_trainings;
update public.club_shared_trainings set is_example = true;
select is((select is_example from public.club_shared_trainings), false, 'he does not mark it as an example');
select tests.logout();

select tests.login('coach2@test.local');
select throws_ok($$
  insert into public.club_shared_trainings (club_id, team_id, session_date, title, age_category, content)
  values ((select id from ids where name = 'club'), (select id from ids where name = 'team'), '2026-11-18', 'X', 'senioren', '{}')$$,
  '42501', null, 'another coach cannot share a training of that team');
select lives_ok($$
  insert into public.club_training_comments (training_id, club_id, body)
  values ((select id from ids where name = 'training'), (select id from ids where name = 'club'), 'Mooie opbouw!') returning id$$,
  'a coach of the club gives feedback (insert ... returning)');
select tests.logout();

select tests.login('td@test.local');
select lives_ok($$update public.club_shared_trainings set is_example = true$$, 'the TD marks it as an example');
select is((select is_example from public.club_shared_trainings), true, 'it is an example now');
select throws_ok($$update public.club_shared_trainings set title = 'Anders'$$, '42501', null, 'the training itself never changes');
select tests.logout();

select tests.login('coach2@test.local');
select is((select count(*)::int from public.club_member_names((select id from ids where name = 'club'))), 4, 'a member sees the names of the club''s members');
select tests.logout();

-- Another club and no module
select tests.login('other@test.local');
select throws_ok($$select * from public.club_member_names((select id from ids where name = 'club'))$$, '42501', null, 'not those of another club');
select is((select count(*)::int from public.club_documents) + (select count(*)::int from public.club_shared_trainings)
  + (select count(*)::int from public.club_training_comments), 0, 'another club sees nothing');
select throws_ok($$
  insert into public.club_training_comments (training_id, club_id, body)
  values ((select id from ids where name = 'training'), (select id from ids where name = 'club'), 'X')$$,
  '42501', null, 'and does not comment');
select throws_ok($$
  insert into public.club_documents (club_id, title, file_path, file_name, uploaded_by)
  select id, 'X', id || '/x/x.pdf', 'x.pdf', tests.id('other@test.local') from ids where name = 'club_y'$$,
  '42501', null, 'without the module nothing is added');
select tests.logout();

select tests.login('coach2@test.local');
delete from public.club_shared_trainings;
select is((select count(*)::int from public.club_shared_trainings), 1, 'a coach does not remove someone else''s training');
select tests.logout();

select tests.login('coach@test.local');
delete from public.club_shared_trainings;
select is((select count(*)::int from public.club_training_comments), 0, 'the author removes his training, with its comments');
select tests.logout();

select * from finish();
rollback;
