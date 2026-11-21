-- Club planning: periods with training goals; owner, admin and TD write, every
-- member reads, nothing for other clubs; only with the planning module.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

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

select tests.create_user(e) from unnest(array['td@test.local', 'coach@test.local', 'other@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('club_y', gen_random_uuid());
insert into public.clubs (id, name, created_by) select id, name, tests.id('td@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, modules)
  select id, 10, case when name = 'club' then '{planning}'::text[] else '{}'::text[] end from ids;
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['td@test.local', 'coach@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, case l.coach_id when tests.id('td@test.local') then 'technical_director' else 'coach' end::public.club_role, l.id
from public.club_licenses l;
insert into public.club_licenses (club_id, coach_id) select id, tests.id('other@test.local') from ids where name = 'club_y';
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l where l.coach_id = tests.id('other@test.local');

select tests.login('td@test.local');
insert into ids select 'period', public.save_club_period((select id from ids where name = 'club'), null,
  '{"title": "Voorbereiding", "starts_on": "2026-07-01", "ends_on": "2026-08-15", "age_categories": ["u17", "u19"], "goals": ["Positiespel", "  ", "Pressing"], "focus": "Balbezit"}');
select results_eq($$select title, age_categories, goals from public.club_periods$$,
  $$values ('Voorbereiding', '{u17,u19}'::text[], '{Positiespel,Pressing}'::text[])$$, 'the TD makes a period (empty goals dropped)');
select lives_ok($$select public.save_club_period((select id from ids where name = 'club'), (select id from ids where name = 'period'),
  '{"title": "Voorbereiding 2", "starts_on": "2026-07-01", "ends_on": "2026-08-20", "goals": []}')$$, 'and changes it');
select is((select title from public.club_periods), 'Voorbereiding 2', 'the change is stored');
select throws_ok($$select public.save_club_period((select id from ids where name = 'club'), null,
  '{"title": "X", "starts_on": "2026-07-01", "ends_on": "2026-06-01"}')$$, '23514', null, 'the end comes after the start');
select throws_ok($$select public.save_club_period((select id from ids where name = 'club'), null,
  '{"title": "X", "starts_on": "2026-07-01", "ends_on": "2026-07-10", "age_categories": ["u8"]}')$$, '23514', null, 'only known age categories');
select tests.logout();

select tests.login('coach@test.local');
select is((select count(*)::int from public.club_periods), 1, 'a coach of the club reads the periods');
select throws_ok($$select public.save_club_period((select id from ids where name = 'club'), null,
  '{"title": "X", "starts_on": "2026-07-01", "ends_on": "2026-07-10"}')$$, '42501', null, 'but does not make them');
select throws_ok($$select public.delete_club_period((select id from ids where name = 'period'))$$, '42501', null, 'nor deletes them');
select throws_ok($$delete from public.club_periods$$, '42501', null, 'the table is read-only');
select tests.logout();

select tests.login('other@test.local');
select is((select count(*)::int from public.club_periods), 0, 'another club sees nothing');
select throws_ok($$select public.save_club_period((select id from ids where name = 'club_y'), null,
  '{"title": "X", "starts_on": "2026-07-01", "ends_on": "2026-07-10"}')$$, '23514', 'module not active', 'not without the module');
select tests.logout();

select tests.login('td@test.local');
select lives_ok($$select public.delete_club_period((select id from ids where name = 'period'))$$, 'the TD deletes a period');
select tests.logout();

select * from finish();
rollback;
