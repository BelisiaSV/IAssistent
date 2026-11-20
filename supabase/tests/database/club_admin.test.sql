-- Club environment, part 2: the platform admin sets clubs up (federation club
-- list, club details, teams, Excel import with activation codes).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

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

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table result (data jsonb) on commit drop;
grant all on ids, result to authenticated;

-- -----------------------------------------------------------------------------
-- A coach can do none of this
-- -----------------------------------------------------------------------------
select tests.login('coach@test.local');
select throws_ok($$select public.admin_save_federation_clubs('[]')$$, '42501', null, 'a coach cannot store federation clubs');
select throws_ok($$select * from public.admin_federation_clubs()$$, '42501', null, 'a coach cannot list federation clubs');
select throws_ok($$select count(*) from public.federation_clubs$$, '42501', null, 'the federation club table is not readable');
select throws_ok($$select * from public.admin_clubs()$$, '42501', null, 'a coach cannot list clubs');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
select tests.login('admin@test.local');
select is(public.admin_save_federation_clubs('[
  {"number": "00042", "name": "Belisia Bilzen SV", "teams": [{"name": "Belisia Bilzen SV A", "divisions": ["3B"]}, {"name": "Belisia Bilzen SV B", "divisions": ["4C"]}]},
  {"number": "00077", "name": "Ander FC", "teams": []}
]'), 2, 'the admin stores the clubs of an export');
select is(public.admin_save_federation_clubs('[{"number": "00077", "name": "Ander FC Genk", "teams": []}]'), 1,
  'storing again updates a club');
select is((select name from public.admin_federation_clubs() where number = '00077'), 'Ander FC Genk',
  'the club list shows the new name');

insert into ids select 'club', public.admin_create_club('Belisia Bilzen SV', '00042');
select is((select club_id from public.admin_federation_clubs() where number = '00042'), (select id from ids where name = 'club'),
  'a federation club shows which club was made from it');
select throws_ok($$select public.admin_create_club('Dubbel', '00042')$$, '23505', null,
  'a registration number belongs to one club');
select lives_ok($$select public.admin_update_club((select id from ids where name = 'club'), 'Belisia Bilzen SV', '00042',
  '#6CB4EE', '#FFFFFF', 'Sportlaan 1, Bilzen', 'Jan Peeters', 'jan@example.test', '0470 00 00 00')$$,
  'the admin updates the club details');
select throws_ok($$select public.admin_update_club((select id from ids where name = 'club'), 'X', null,
  'blauw', null, null, null, null, null)$$, '23514', null, 'a colour must be a hex code');

-- No subscription yet: teams cannot be made.
select throws_ok($$select public.create_club_team((select id from ids where name = 'club'), 'A-ploeg', null)$$,
  '23514', 'club is not active', 'no teams before the subscription');
select public.admin_set_club_subscription((select id from ids where name = 'club'),
  (select id from public.plans where code = 'club-start'), 3, 3, null, current_date, null);
insert into ids select 'team_a', public.create_club_team((select id from ids where name = 'club'), 'A-ploeg', null);
select is((select count(*)::int from public.teams), 0, 'the platform admin does not read team data itself');
select tests.logout();
select is((select primary_color from public.teams where id = (select id from ids where name = 'team_a')), '#6CB4EE',
  'a new club team takes the club''s colour');
select is((select club_name from public.teams where id = (select id from ids where name = 'team_a')), 'Belisia Bilzen SV',
  'a new club team takes the club''s name');
select tests.login('admin@test.local');

-- Import of the Excel
select throws_ok($$select public.admin_import_club((select id from ids where name = 'club'), '{
  "teams": [],
  "staff": [{"name": "Piet", "role": "coach", "team": "Onbekend", "team_role": "head_coach"}]
}')$$, '23514', 'unknown team Onbekend', 'a staff row with an unknown team stops the import');
select is((select count(*)::int from public.club_activation_codes), 0, 'a failed import leaves no codes');

insert into result select public.admin_import_club((select id from ids where name = 'club'), '{
  "club": {"contact_name": "Els Maes"},
  "teams": [
    {"name": "a-ploeg", "age_category": "senioren", "season": "2026-2027", "federation_team": "Belisia Bilzen SV A", "divisions": ["3B"]},
    {"name": "U17", "age_category": "u17", "season": "2026-2027", "federation_team": "", "divisions": []}
  ],
  "staff": [
    {"name": "Jordy", "role": "owner", "team": "", "team_role": ""},
    {"name": "Tom", "role": "coach", "team": "U17", "team_role": "head_coach"},
    {"name": "Lien", "role": "admin", "team": "", "team_role": ""}
  ]
}');
select is((select (data->>'teams_created')::int from result), 1, 'one new team is created');
select is((select (data->>'teams_updated')::int from result), 1, 'an existing team is matched on its name');
select is((select federation_team from public.admin_club_teams((select id from ids where name = 'club')) where id = (select id from ids where name = 'team_a')), 'Belisia Bilzen SV A',
  'the team is linked to the competition');
select is((select jsonb_array_length(data->'codes') from result), 3, 'every staff member gets a code');
select matches((select data->'codes'->1->>'code' from result), '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$',
  'the codes are returned once');
select is((select contact_name from public.clubs where id = (select id from ids where name = 'club')), 'Els Maes',
  'the club details are updated');
select tests.logout();

select tests.login('coach@test.local');
select ok((public.redeem_club_activation_code((select data->'codes'->1->>'code' from result)) ->> 'ok')::boolean,
  'a coach redeems his code from the import');
select ok(public.can_write_team((select t.id from public.teams t where t.name = 'U17')),
  'and coaches the team named in the Excel');
select tests.logout();

select * from finish();
rollback;
