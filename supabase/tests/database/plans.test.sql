-- Price plans: everyone reads the active plans, only platform admins manage
-- them and assign a plan to an account; a coach never changes his own plan.
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

select tests.create_user('admin@test.local');
select tests.create_user('coach@test.local');
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));
insert into public.plans (code, name, audience, active) values ('verborgen', 'Verborgen', 'club', false);

select tests.login('coach@test.local');
select is((select count(*)::int from public.plans where code = 'coach-pro'), 1, 'a coach reads the active plans');
select is((select count(*)::int from public.plans where code = 'verborgen'), 0, 'a coach does not see inactive plans');
select throws_ok($$insert into public.plans (code, name, audience) values ('eigen', 'Eigen', 'club')$$,
  '42501', null, 'a coach cannot create a plan');
update public.plans set price_cents = 0 where code = 'coach-pro';
select tests.logout();
select is((select price_cents from public.plans where code = 'coach-pro'), 1995, 'a coach cannot change a plan');

select tests.login('coach@test.local');
select throws_ok($$update public.coaches set plan_id = (select id from public.plans where code = 'club-academy') where id = tests.id('coach@test.local')$$,
  '42501', null, 'a coach cannot change his own plan');
select throws_ok($$select public.admin_set_account_plan(tests.id('coach@test.local'), (select id from public.plans where code = 'coach-pro'))$$,
  '42501', null, 'a coach cannot use the admin function to assign a plan');
select throws_ok($$select * from public.admin_accounts()$$, '42501', null, 'a coach cannot list the accounts');
select tests.logout();

select tests.login('admin@test.local');
select is((select count(*)::int from public.plans where code = 'verborgen'), 1, 'an admin also sees inactive plans');
insert into public.plans (code, name, audience, price_cents) values ('nieuw', 'Nieuw plan', 'individual', 999) returning code;
select is((select name from public.plans where code = 'nieuw'), 'Nieuw plan', 'an admin creates a plan');
update public.plans set name = 'Coach Pro+', price_cents = 2495 where code = 'coach-pro';
select is((select name || ' ' || price_cents from public.plans where code = 'coach-pro'), 'Coach Pro+ 2495', 'an admin changes a plan');
select lives_ok($$select public.admin_set_account_plan(tests.id('coach@test.local'), (select id from public.plans where code = 'club-start'))$$,
  'an admin assigns a plan to an account');
select is((select p.code from public.admin_accounts() a join public.plans p on p.id = a.plan_id where a.id = tests.id('coach@test.local')), 'club-start',
  'the admin sees the plan of the account');
select tests.logout();

select tests.login('coach@test.local');
select is((select p.code from public.coaches c join public.plans p on p.id = c.plan_id where c.id = tests.id('coach@test.local')), 'club-start',
  'the coach reads his own plan');
select tests.logout();

select tests.login('admin@test.local');
delete from public.plans where code = 'club-start';
select is((select plan_id from public.coaches where id = tests.id('coach@test.local')), null, 'deleting a plan leaves the account without a plan');

select * from finish();
rollback;
