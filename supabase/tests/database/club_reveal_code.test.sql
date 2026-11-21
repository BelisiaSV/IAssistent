-- See an open activation code again: only those who may revoke it, only while
-- it is open; the stored code is never readable directly and is removed once
-- the code is used or revoked.
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

select tests.create_user(e) from unnest(array['owner@test.local', 'clubadmin@test.local', 'coach@test.local', 'trainer@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table codes (name text primary key, id uuid, code text) on commit drop;
grant all on ids, codes to authenticated;
insert into ids values ('club', gen_random_uuid());

insert into public.clubs (id, name, created_by) select id, 'Club X', tests.id('owner@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, max_teams) select id, 5, 5 from ids;
insert into public.club_licenses (club_id, coach_id) select id, tests.id('owner@test.local') from ids;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l;
insert into public.club_members (club_id, coach_id, role)
select id, tests.id('clubadmin@test.local'), 'admin' from ids;

select tests.login('owner@test.local');
insert into codes select 'coach', c.id, c.code from public.create_club_activation_code((select id from ids where name = 'club'), 'coach') c;
insert into codes select 'admin', c.id, c.code from public.create_club_activation_code((select id from ids where name = 'club'), 'admin') c;
insert into codes select 'gone', c.id, c.code from public.create_club_activation_code((select id from ids where name = 'club'), 'coach') c;
select is(public.reveal_club_activation_code((select id from codes where name = 'coach')),
  (select code from codes where name = 'coach'), 'the owner sees the full code');
select is((select count(*)::int from public.club_audit_log where action = 'code.revealed'), 1, 'looking is logged');
select throws_ok($$select * from public.club_activation_code_secrets$$, '42501', null,
  'the stored codes are not readable directly');
select tests.logout();

select tests.login('clubadmin@test.local');
select is(public.reveal_club_activation_code((select id from codes where name = 'coach')),
  (select code from codes where name = 'coach'), 'a club admin sees a coach code');
select throws_ok($$select public.reveal_club_activation_code((select id from codes where name = 'admin'))$$,
  '42501', null, 'a club admin cannot see an admin code');
select tests.logout();

select tests.login('coach@test.local');
select throws_ok($$select public.reveal_club_activation_code((select id from codes where name = 'coach'))$$,
  '42501', null, 'someone outside the club cannot see a code');
select tests.logout();

-- Used and revoked codes are not kept
select tests.login('trainer@test.local');
select is(public.redeem_club_activation_code((select code from codes where name = 'coach')) ->> 'ok', 'true', 'the code is redeemed');
select tests.logout();
select tests.login('owner@test.local');
select throws_ok($$select public.reveal_club_activation_code((select id from codes where name = 'coach'))$$,
  '23514', 'code is not open', 'a used code cannot be seen');
select public.revoke_club_activation_code((select id from codes where name = 'gone'));
insert into codes select 'new', c.id, c.code from public.reissue_club_activation_code((select id from codes where name = 'admin')) c;
select is(public.reveal_club_activation_code((select id from codes where name = 'new')),
  (select code from codes where name = 'new'), 'a reissued code can be seen');
select tests.logout();

select is((select count(*)::int from public.club_activation_code_secrets s
  where s.code_id in (select id from codes where name in ('coach', 'gone', 'admin'))), 0,
  'used and revoked codes are removed');

-- A code made before codes were kept
delete from public.club_activation_code_secrets where code_id = (select id from codes where name = 'new');
select tests.login('owner@test.local');
select is(public.reveal_club_activation_code((select id from codes where name = 'new')), null,
  'an older code without a stored code gives null');
select tests.logout();

select * from finish();
rollback;
