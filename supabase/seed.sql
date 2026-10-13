-- =============================================================================
-- Seed — ALLEEN voor lokaal en staging. Nooit op productie uitvoeren.
-- Eén fictieve testcoach met één fictief testteam en enkele fictieve spelers.
--
--   E-mail:     coach@iassistent.test
--   Wachtwoord: Testcoach123!
-- =============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'coach@iassistent.test',
  extensions.crypt('Testcoach123!', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Test Coach"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub": "11111111-1111-4111-8111-111111111111", "email": "coach@iassistent.test", "email_verified": true}',
  'email', now(), now(), now()
);

-- coaches + coach_profiles are created by the on_auth_user_created trigger.
update public.coach_profiles
set vision_summary = 'Testvisie (fictief) voor ontwikkeling en staging.'
where coach_id = '11111111-1111-4111-8111-111111111111';

insert into public.teams (id, head_coach_id, name, season, club_name, primary_color, secondary_color)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Eerste ploeg',
  '2026-2027',
  'KFC Teststad',
  '#0B3D91',
  '#F2C200'
);

-- Fictieve kern (namen verzonnen).
insert into public.players
  (team_id, first_name, last_name, shirt_number, primary_position, secondary_positions,
   preferred_foot, birth_year, joined_club_year, status, expected_return_date)
values
  ('22222222-2222-4222-8222-222222222222', 'Thomas', 'Claes', 1, 'GK', '{}', 'right', 1996, 2019, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Robbe', 'Wouters', 12, 'GK', '{}', 'right', 2002, 2024, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Jonas', 'Peeters', 2, 'RB', '{RWB}', 'right', 1999, 2021, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Arne', 'Maes', 3, 'LB', '{LWB}', 'left', 2000, 2022, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Wout', 'Jacobs', 4, 'CB', '{}', 'right', 1995, 2018, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Bram', 'Mertens', 5, 'CB', '{CDM}', 'left', 1998, 2020, 'injured', current_date + 21),
  ('22222222-2222-4222-8222-222222222222', 'Senne', 'Willems', 15, 'CB', '{RB}', 'right', 2003, 2025, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Lars', 'Goossens', 6, 'CDM', '{CM}', 'right', 1997, 2019, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Kobe', 'Janssens', 8, 'CM', '{CDM,CAM}', 'right', 2001, 2023, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Milan', 'Hermans', 10, 'CAM', '{CM,ST}', 'left', 2000, 2021, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Stijn', 'Vermeulen', 14, 'CM', '{}', 'both', 2002, 2024, 'suspended', null),
  ('22222222-2222-4222-8222-222222222222', 'Ruben', 'Dubois', 7, 'RM', '{RW}', 'right', 2001, 2022, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Thibo', 'Lambert', 11, 'LM', '{LW}', 'left', 1999, 2020, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Noah', 'Desmet', 17, 'LW', '{LM,ST}', 'left', 2004, 2025, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Jens', 'De Smet', 9, 'ST', '{}', 'right', 1996, 2017, 'available', null),
  ('22222222-2222-4222-8222-222222222222', 'Yentl', 'Martens', 19, 'ST', '{RW}', 'right', 2003, 2024, 'unavailable', null);
