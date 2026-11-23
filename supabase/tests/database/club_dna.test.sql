-- Club DNA: draft, approval, versions, who reads what, module and club separation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

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

select tests.create_user(e) from unnest(array['owner@test.local', 'cadmin@test.local', 'td@test.local', 'coach@test.local', 'other@test.local']) e;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('club', gen_random_uuid()), ('club_y', gen_random_uuid());

insert into public.clubs (id, name, created_by) select id, name, tests.id('owner@test.local') from ids;
insert into public.club_subscriptions (club_id, license_seats, modules)
  select id, 10, case when name = 'club' then '{dna}'::text[] else '{}'::text[] end from ids;
insert into public.club_licenses (club_id, coach_id)
select (select id from ids where name = 'club'), tests.id(e) from unnest(array['owner@test.local', 'td@test.local', 'coach@test.local']) e;
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id,
  case l.coach_id when tests.id('owner@test.local') then 'owner' when tests.id('td@test.local') then 'technical_director' else 'coach' end::public.club_role,
  l.id
from public.club_licenses l;
insert into public.club_members (club_id, coach_id, role)
select id, tests.id('cadmin@test.local'), 'admin' from ids where name = 'club';
-- other@ is owner of club Y (no DNA module)
insert into public.club_licenses (club_id, coach_id) select id, tests.id('other@test.local') from ids where name = 'club_y';
insert into public.club_members (club_id, coach_id, role, license_id)
select l.club_id, l.coach_id, 'owner', l.id from public.club_licenses l where l.coach_id = tests.id('other@test.local');

-- A coach does not edit
select tests.login('coach@test.local');
select throws_ok($$select public.save_club_dna_draft((select id from ids where name = 'club'), '{"samenvatting": "x"}')$$,
  '42501', null, 'a coach cannot edit the club DNA');
select tests.logout();

-- The TD writes a draft
select tests.login('td@test.local');
select lives_ok($$select public.save_club_dna_draft((select id from ids where name = 'club'), '{"samenvatting": "Eerste"}')$$,
  'the technical director saves a draft');
select lives_ok($$select public.save_club_dna_draft((select id from ids where name = 'club'), '{"samenvatting": "Eerste, herwerkt"}')$$,
  'saving again updates the same draft');
select is((select count(*)::int from public.club_dna), 1, 'there is one draft');
select tests.logout();

select tests.login('coach@test.local');
select is((select count(*)::int from public.club_dna), 0, 'a coach does not see the draft');
select tests.logout();

-- Owner and admin are one role (club manager): an admin may publish too
select tests.login('cadmin@test.local');
select ok(public.has_club_role((select id from ids where name = 'club'), '{owner,technical_director}'),
  'a club admin is a club manager and may publish');
select tests.logout();

select tests.login('td@test.local');
select lives_ok($$select public.publish_club_dna((select id from ids where name = 'club'), 'Eerste versie')$$,
  'the technical director publishes');
select throws_ok($$select public.publish_club_dna((select id from ids where name = 'club'))$$, '23514', 'no draft',
  'nothing to publish without a draft');
select public.save_club_dna_draft((select id from ids where name = 'club'), '{"samenvatting": "Tweede"}');
select is((select version from public.club_dna where status = 'draft'), 2, 'a new draft gets the next version');
select tests.logout();

select tests.login('coach@test.local');
select results_eq($$select content->>'samenvatting' from public.club_dna$$, $$values ('Eerste, herwerkt')$$,
  'a coach reads the published version only');
select tests.logout();

select tests.login('owner@test.local');
select lives_ok($$select public.publish_club_dna((select id from ids where name = 'club'))$$, 'the owner publishes the next version');
select results_eq($$select status from public.club_dna order by version$$, $$values ('archived'), ('published')$$,
  'the earlier version is archived, not deleted');
select ok(exists (select 1 from public.club_audit_log where action = 'dna.published'), 'publishing is in the history');
select public.save_club_dna_draft((select id from ids where name = 'club'), '{"samenvatting": "Weg"}');
select lives_ok($$select public.discard_club_dna_draft((select id from ids where name = 'club'))$$, 'a draft can be thrown away');
select is((select count(*)::int from public.club_dna where status = 'draft'), 0, 'the draft is gone');
select tests.logout();

-- Another club: no module, and nothing of club X
select tests.login('other@test.local');
select throws_ok($$select public.save_club_dna_draft((select id from ids where name = 'club_y'), '{}')$$, '23514', 'module not active',
  'a club without the module cannot make a DNA');
select is((select count(*)::int from public.club_dna), 0, 'another club sees nothing of club X');
select tests.logout();

select * from finish();
rollback;
