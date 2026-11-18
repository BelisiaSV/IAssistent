-- Media of the exercise bank: only the platform admin uploads and links files;
-- a coach reads the file of an approved exercise only.
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

select tests.create_user('admin@test.local');
select tests.create_user('coach@test.local');
insert into public.platform_admins (coach_id) values (tests.id('admin@test.local'));

create temp table batch (data jsonb) on commit drop;
grant all on batch to authenticated;
insert into batch values ('[
  {"number": "OEF-001", "title": "Rondo", "kind": "Rondo", "phase": null, "target_group": null, "tags": [], "principles": [],
   "content": {}, "media_kind": "video", "media_key": "k1"},
  {"number": "OEF-002", "title": "Partijvorm", "kind": "Partijvorm", "phase": null, "target_group": null, "tags": [], "principles": [],
   "content": {}, "media_kind": "image", "media_key": "k2"}
]');

select tests.login('coach@test.local');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('bank-media', 'k1.mp4')$$,
  '42501', null, 'a coach cannot upload bank media');
select throws_ok($$select public.admin_set_bank_media('k1', 'k1.mp4')$$, '42501', null, 'a coach cannot link bank media');
select tests.logout();

select tests.login('admin@test.local');
select public.admin_import_bank_exercises((select data from batch));
select lives_ok($$insert into storage.objects (bucket_id, name) values ('bank-media', 'k1.mp4'), ('bank-media', 'k2.png')$$,
  'the admin uploads bank media');
select is(public.admin_set_bank_media('k1', 'k1.mp4'), 1, 'the admin links a file to the exercise with that code');
select public.admin_set_bank_media('k2', 'k2.png');
select public.admin_set_bank_exercise_status((select id from public.bank_exercises where number = 'OEF-001'), 'approved');
select tests.logout();

select tests.login('coach@test.local');
select is((select string_agg(name, ',') from storage.objects where bucket_id = 'bank-media'), 'k1.mp4',
  'a coach reads the file of an approved exercise only');
select tests.logout();

select tests.login('admin@test.local');
select is(public.admin_import_bank_exercises((select data from batch)), '{"added": 0, "updated": 0, "unchanged": 2}'::jsonb,
  'importing the same file keeps the links');
select is((select media_path from public.bank_exercises where number = 'OEF-001'), 'k1.mp4', 'the link stays');
select public.admin_import_bank_exercises(jsonb_set((select data from batch), '{0,media_key}', '"k9"'));
select is((select media_path from public.bank_exercises where number = 'OEF-001'), null, 'a new code drops the old link');
select public.admin_import_bank_exercises('[{"number": "OEF-003", "title": "Kopie", "kind": "Rondo", "phase": null, "target_group": null,
  "tags": [], "principles": [], "content": {}, "media_kind": "image", "media_key": "k2"}]'::jsonb);
select is((select media_path from public.bank_exercises where number = 'OEF-003'), 'k2.png', 'a new exercise with a known code gets the file');
select tests.logout();

-- Corrections in the app.
select tests.login('coach@test.local');
select throws_ok($$select public.admin_update_bank_exercise((select id from public.bank_exercises where number = 'OEF-002'),
  'x', 'Rondo', null, null, '{}', '{}', '{}')$$, '42501', null, 'a coach cannot correct a bank exercise');
select tests.logout();
select tests.login('admin@test.local');
select public.admin_update_bank_exercise((select id from public.bank_exercises where number = 'OEF-002'),
  'Partijvorm 7v7', 'Partijvorm', 'Balbezit', null, '{breedte}', '{Breedte}', '{"hoofddoel": "Scoren"}');
select is((select title || ' ' || version || ' ' || (content->>'hoofddoel') from public.bank_exercises where number = 'OEF-002'),
  'Partijvorm 7v7 2 Scoren', 'the admin corrects a bank exercise (new version)');
select is(public.admin_import_bank_exercises((select data from batch) - 0), '{"added": 0, "updated": 0, "unchanged": 1}'::jsonb,
  'an unchanged source does not overwrite the correction');
select is((select title from public.bank_exercises where number = 'OEF-002'), 'Partijvorm 7v7', 'the correction stays');
select is(public.admin_import_bank_exercises(jsonb_set((select data from batch) - 0, '{0,title}', '"Partijvorm 8v8"')),
  '{"added": 0, "updated": 1, "unchanged": 0}'::jsonb, 'a change in the source overwrites');
select is((select title from public.bank_exercises where number = 'OEF-002'), 'Partijvorm 8v8', 'the source wins after its own change');
select tests.logout();

-- Replacing the picture of one exercise.
select tests.login('coach@test.local');
select throws_ok($$select public.admin_set_bank_exercise_media('OEF-002', 'x.png', 'image')$$, '42501', null, 'a coach cannot replace a picture');
select tests.logout();
select tests.login('admin@test.local');
select public.admin_set_bank_exercise_media('OEF-002', 'OEF-002-1.mp4', 'video');
select is((select media_path || ' ' || media_kind from public.bank_exercises where number = 'OEF-002'), 'OEF-002-1.mp4 video',
  'the admin replaces the picture of one exercise');
select throws_ok($$select public.admin_set_bank_exercise_media('OEF-002', 'x.png', 'pdf')$$, '23514', null, 'only an image or a video');
select tests.logout();

select * from finish();
rollback;
