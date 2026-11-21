-- A new code for an open activation code: the old one stops working, the new one
-- keeps role, team and note; only those who may revoke may reissue.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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

select tests.create_user(e) from unnest(array['owner@test.local', 'coach@test.local', 'trainer@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table codes (name text primary key, id uuid, code text) on commit drop;
grant all on ids, codes to authenticated;
insert into ids values ('club', gen_random_uuid());

insert into public.clubs (id, name, created_by) select id, 'Club X', tests.id('owner@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, max_teams) select id, 3, 5 from ids;
insert into public.club_licenses (club_id, coach_id) select id, tests.id('owner@test.local') from ids;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l;

select tests.login('owner@test.local');
insert into ids select 'team', public.create_club_team((select id from ids where name = 'club'), 'A-ploeg', null);
insert into codes select 'old', c.id, c.code from public.create_club_activation_code(
  (select id from ids where name = 'club'), 'coach', null, (select id from ids where name = 'team'), 'head_coach', 'Alain') c;
select is(public.club_seats_used((select id from ids where name = 'club')), 2, 'the open code holds a seat');
insert into codes select 'new', c.id, c.code from public.reissue_club_activation_code((select id from codes where name = 'old')) c;
select is((select status from public.club_activation_codes where id = (select id from codes where name = 'old')), 'revoked',
  'the old code is revoked');
select results_eq(
  $$select role::text, team_role, note from public.club_activation_codes where id = (select id from codes where name = 'new')$$,
  $$values ('coach', 'head_coach', 'Alain')$$, 'the new code keeps role, team role and note');
select is(public.club_seats_used((select id from ids where name = 'club')), 2, 'the new code takes over the seat');
select throws_ok($$select * from public.reissue_club_activation_code((select id from codes where name = 'old'))$$,
  '23514', 'code is not open', 'a revoked code cannot be reissued');
select tests.logout();

select tests.login('coach@test.local');
select throws_ok($$select * from public.reissue_club_activation_code((select id from codes where name = 'new'))$$,
  '42501', null, 'someone outside the club cannot reissue');
select tests.logout();

select tests.login('trainer@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'old')) ->> 'error', 'invalid', 'the old code no longer works');
select is(public.redeem_club_activation_code((select code from codes where name = 'new')) ->> 'ok', 'true', 'the new code works');
select tests.logout();

select * from finish();
rollback;
