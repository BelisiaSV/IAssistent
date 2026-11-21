-- Shared exercise library of a club: proposals, approval, recommendation, bank
-- picks, sharing an own exercise, module and club separation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

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

select tests.create_user(e) from unnest(array['td@test.local', 'coach@test.local', 'coach2@test.local', 'other@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('club_y', gen_random_uuid());

insert into public.clubs (id, name, created_by) select id, name, tests.id('td@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, modules)
  select id, 10, case when name = 'club' then '{exercises}'::text[] else '{}'::text[] end from ids;
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['td@test.local', 'coach@test.local', 'coach2@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, case l.coach_id when tests.id('td@test.local') then 'technical_director' else 'coach' end::public.club_role, l.id
from public.club_licenses l;
insert into public.club_licenses (club_id, coach_id) select id, tests.id('other@test.local') from ids where name = 'club_y';
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l where l.coach_id = tests.id('other@test.local');

insert into public.bank_exercises (number, title, kind, status, content, source_content)
values ('OEF-001', 'Rondo', 'Rondo', 'approved', '{}', '{}'), ('OEF-002', 'Nog niet', 'Rondo', 'review', '{}', '{}');
with x as (insert into public.exercises (coach_id, title) values (tests.id('coach@test.local'), 'Mijn oefening') returning id)
insert into ids select 'own', id from x;
with x as (insert into public.exercises (coach_id, title) values (tests.id('coach2@test.local'), 'Van een ander') returning id)
insert into ids select 'foreign', id from x;

-- A coach proposes, shares his own exercise, not someone else's
select tests.login('coach@test.local');
insert into ids select 'proposal', public.save_club_exercise((select id from ids where name = 'club'), null,
  '{"title": "Positiespel 4v4+3", "kind": "Positiespel", "age_categories": ["u17"], "origin": "club"}');
select is((select status from public.club_exercises where id = (select id from ids where name = 'proposal')), 'proposed',
  'a coach''s exercise is a proposal');
select is((select number from public.club_exercises where id = (select id from ids where name = 'proposal')), 'CLUB-1',
  'the first club exercise is CLUB-1');
select lives_ok($$select public.save_club_exercise((select id from ids where name = 'club'), null,
  jsonb_build_object('title', 'Gedeeld', 'kind', 'Oefening', 'origin', 'coach_share', 'source_exercise_id', (select id from ids where name = 'own')))$$,
  'a coach shares his own exercise');
select throws_ok($$select public.save_club_exercise((select id from ids where name = 'club'), null,
  jsonb_build_object('title', 'Gestolen', 'kind', 'Oefening', 'origin', 'coach_share', 'source_exercise_id', (select id from ids where name = 'foreign')))$$,
  '42501', null, 'a coach cannot share someone else''s exercise');
select lives_ok($$select public.save_club_exercise((select id from ids where name = 'club'), (select id from ids where name = 'proposal'),
  '{"title": "Positiespel 4v4+3 (aangepast)", "kind": "Positiespel"}')$$, 'the author changes his own proposal');
select throws_ok($$select public.set_club_exercise_status((select id from ids where name = 'proposal'), 'approved')$$,
  '42501', null, 'a coach cannot approve');
select throws_ok($$select public.set_club_bank_pick((select id from ids where name = 'club'), 'OEF-001', true)$$,
  '42501', null, 'a coach cannot pick bank exercises for the club');
select tests.logout();

select tests.login('coach2@test.local');
select is((select count(*)::int from public.club_exercises), 0, 'another coach does not see proposals');
select throws_ok($$select public.save_club_exercise((select id from ids where name = 'club'), (select id from ids where name = 'proposal'),
  '{"title": "Overschreven", "kind": "X"}')$$, '42501', null, 'another coach cannot change a proposal');
select tests.logout();

-- The technical director approves, recommends, picks
select tests.login('td@test.local');
select is((select count(*)::int from public.club_exercises), 2, 'the TD sees all proposals');
select throws_ok($$select public.set_club_exercise_recommended((select id from ids where name = 'proposal'), true)$$,
  '23514', 'only approved exercises are recommended', 'a proposal cannot be recommended');
select lives_ok($$select public.set_club_exercise_status((select id from ids where name = 'proposal'), 'approved')$$, 'the TD approves');
select lives_ok($$select public.set_club_exercise_recommended((select id from ids where name = 'proposal'), true)$$, 'and recommends it');
insert into ids select 'td_ex', public.save_club_exercise((select id from ids where name = 'club'), null,
  '{"title": "Variant rondo", "kind": "Rondo", "origin": "bank_variant", "base_bank_number": "OEF-001"}');
select is((select status from public.club_exercises where id = (select id from ids where name = 'td_ex')), 'approved',
  'an exercise of the TD is approved at once');
select lives_ok($$select public.set_club_bank_pick((select id from ids where name = 'club'), 'OEF-001', true, true)$$,
  'the TD recommends a bank exercise');
select throws_ok($$select public.set_club_bank_pick((select id from ids where name = 'club'), 'OEF-002', true)$$,
  '23514', 'unknown bank exercise', 'only approved bank exercises can be picked');
select tests.logout();

select tests.login('coach2@test.local');
select results_eq($$select number from public.club_exercises order by number$$, $$values ('CLUB-1'), ('CLUB-3')$$,
  'a coach reads the approved exercises');
select is((select count(*)::int from public.club_bank_picks where recommended), 1, 'and the recommended bank exercises');
select tests.logout();

-- Another club: no module, nothing of club X
select tests.login('other@test.local');
select throws_ok($$select public.save_club_exercise((select id from ids where name = 'club_y'), null, '{"title": "X", "kind": "Y"}')$$,
  '23514', 'module not active', 'a club without the module cannot add exercises');
select is((select count(*)::int from public.club_exercises) + (select count(*)::int from public.club_bank_picks), 0,
  'another club sees nothing of club X');
select tests.logout();

select * from finish();
rollback;
