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

insert into public.players (team_id, first_name, last_name, shirt_number, position, birth_year, status) values
  ('22222222-2222-4222-8222-222222222222', 'Test', 'Doelman',    1, 'Doelman',       1995, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Test', 'Verdediger', 4, 'Verdediger',    1998, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Test', 'Middenvelder', 8, 'Middenvelder', 2000, 'injured'),
  ('22222222-2222-4222-8222-222222222222', 'Test', 'Spits',      9, 'Aanvaller',     2001, 'available');
