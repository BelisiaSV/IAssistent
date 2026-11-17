-- Exercise bank: only the platform admin imports and approves; coaches read
-- the approved exercises only; nobody writes the table directly.
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

select tests.create_user('admin@test.local');
select tests.create_user('coach@test.local');
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table batch (data jsonb) on commit drop;
grant all on batch to authenticated;
insert into batch values ('[
  {"number": "OEF-001", "source_id": "a", "title": "Rondo 4v2", "kind": "Rondo", "phase": "Balbezit",
   "target_group": null, "tags": ["rondo"], "principles": [], "content": {"hoofddoel": "Bal houden"},
   "media_kind": "image", "media_key": "k1"},
  {"number": "OEF-002", "source_id": "b", "title": "Partijvorm", "kind": "Partijvorm", "phase": "Balbezit",
   "target_group": null, "tags": [], "principles": ["Breedte"], "content": {"hoofddoel": "Scoren"},
   "media_kind": null, "media_key": null}
]');

select tests.login('coach@test.local');
select throws_ok($$select public.admin_import_bank_exercises((select data from batch))$$,
  '42501', null, 'a coach cannot import');
select throws_ok($$insert into public.bank_exercises (number, title, kind, content) values ('OEF-9', 'x', 'y', '{}')$$,
  '42501', null, 'a coach cannot insert directly');
select tests.logout();

select tests.login('admin@test.local');
select is(public.admin_import_bank_exercises((select data from batch)), '{"added": 2, "updated": 0, "unchanged": 0}'::jsonb,
  'the admin imports new exercises');
select is((select count(*)::int from public.bank_exercises where status = 'review'), 2, 'new exercises are to be checked');
select is(public.admin_import_bank_exercises((select data from batch)), '{"added": 0, "updated": 0, "unchanged": 2}'::jsonb,
  'the same file again changes nothing');
select lives_ok($$select public.admin_set_bank_exercise_status((select id from public.bank_exercises where number = 'OEF-001'), 'approved')$$,
  'the admin approves an exercise');
select is(public.admin_import_bank_exercises(jsonb_set((select data from batch), '{0,content,hoofddoel}', '"Bal houden onder druk"')),
  '{"added": 0, "updated": 1, "unchanged": 1}'::jsonb, 'a changed exercise is updated');
select is((select status || ' ' || version from public.bank_exercises where number = 'OEF-001'), 'approved 2',
  'an update keeps the status and raises the version');
select throws_ok($$update public.bank_exercises set title = 'x'$$, '42501', null, 'even the admin does not write directly');
select tests.logout();

select tests.login('coach@test.local');
select is((select string_agg(number, ',') from public.bank_exercises), 'OEF-001', 'a coach sees only approved exercises');
select throws_ok($$select public.admin_set_bank_exercise_status((select id from public.bank_exercises where number = 'OEF-001'), 'review')$$,
  '42501', null, 'a coach cannot change the status');
select tests.logout();

select tests.login('admin@test.local');
select throws_ok($$select public.admin_set_bank_exercise_status((select id from public.bank_exercises where number = 'OEF-001'), 'weg')$$,
  '23514', null, 'only known statuses');
select is((select count(*)::int from public.bank_exercises), 2, 'the admin sees all exercises');
select tests.logout();

select * from finish();
rollback;
