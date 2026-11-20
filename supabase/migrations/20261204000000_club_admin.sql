-- =============================================================================
-- Club environment, part 2: the platform admin sets clubs up.
--
--   * federation_clubs: the clubs found in the Voetbal Vlaanderen export
--     (registration number, name, teams with their divisions). The admin
--     picks a club from it; nobody else reads it.
--   * clubs get their registration number, colours and a contact.
--   * The admin creates club teams himself, and imports the Excel the club
--     filled in (club details, teams, staff): one activation code per staff
--     member, returned once.
--   * Read functions for the admin pages: clubs with their numbers, teams and
--     members of one club.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clubs from the federation export
-- -----------------------------------------------------------------------------
create table public.federation_clubs (
  number text primary key check (number ~ '^[0-9A-Za-z]{1,10}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  -- [{ name, divisions: [..] }]
  teams jsonb not null default '[]'::jsonb check (jsonb_typeof(teams) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.federation_clubs enable row level security;
revoke all on public.federation_clubs from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- Club details
-- -----------------------------------------------------------------------------
alter table public.clubs
  add column federation_number text unique check (federation_number is null or federation_number ~ '^[0-9A-Za-z]{1,10}$'),
  add column primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column address text check (address is null or length(address) <= 200),
  add column contact_name text check (contact_name is null or length(contact_name) <= 120),
  add column contact_email text check (contact_email is null or length(contact_email) <= 200),
  add column contact_phone text check (contact_phone is null or length(contact_phone) <= 40);

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Admin: store the clubs found in an export (merged with what is there).
create function public.admin_save_federation_clubs(p_clubs jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  if jsonb_typeof(p_clubs) <> 'array' or jsonb_array_length(p_clubs) > 2000 then
    raise exception 'invalid clubs' using errcode = 'check_violation';
  end if;
  insert into public.federation_clubs (number, name, teams, updated_at)
  select distinct on (x->>'number') x->>'number', trim(x->>'name'), coalesce(x->'teams', '[]'::jsonb), now()
  from jsonb_array_elements(p_clubs) x
  where coalesce(x->>'number', '') <> '' and coalesce(trim(x->>'name'), '') <> ''
  on conflict (number) do update set
    name = excluded.name,
    teams = excluded.teams,
    updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.admin_federation_clubs()
returns table (number text, name text, teams jsonb, club_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query
    select f.number, f.name, f.teams, c.id
    from public.federation_clubs f
    left join public.clubs c on c.federation_number = f.number
    order by f.name;
end;
$$;

-- Admin: create a club, optionally with its registration number.
drop function public.admin_create_club(text);
create function public.admin_create_club(p_name text, p_federation_number text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins create clubs' using errcode = '42501';
  end if;
  insert into public.clubs (name, created_by, federation_number)
  values (trim(p_name), (select auth.uid()), nullif(trim(p_federation_number), ''))
  returning id into v_id;
  perform public.club_audit(v_id, 'club.created', null, null,
    jsonb_build_object('name', trim(p_name), 'federation_number', p_federation_number));
  return v_id;
end;
$$;

-- Admin: club details.
create function public.admin_update_club(
  p_club_id uuid,
  p_name text,
  p_federation_number text,
  p_primary_color text,
  p_secondary_color text,
  p_address text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  update public.clubs set
    name = trim(p_name),
    federation_number = nullif(trim(p_federation_number), ''),
    primary_color = nullif(trim(p_primary_color), ''),
    secondary_color = nullif(trim(p_secondary_color), ''),
    address = nullif(trim(p_address), ''),
    contact_name = nullif(trim(p_contact_name), ''),
    contact_email = nullif(trim(p_contact_email), ''),
    contact_phone = nullif(trim(p_contact_phone), '')
  where id = p_club_id;
  if not found then
    raise exception 'club not found' using errcode = 'P0002';
  end if;
  perform public.club_audit(p_club_id, 'club.updated');
end;
$$;

-- Club teams: the club's owner or admin, or the platform admin. The team
-- takes the club's colours when it has them.
create or replace function public.create_club_team(
  p_club_id uuid,
  p_name text,
  p_club_name text,
  p_age_category text default null,
  p_season text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_club public.clubs;
begin
  if not (public.has_club_role(p_club_id, '{owner,admin}') or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_club from public.clubs where id = p_club_id;
  insert into public.teams (head_coach_id, club_id, name, club_name, age_category, season, primary_color, secondary_color)
  values (
    (select auth.uid()), p_club_id, trim(p_name), coalesce(nullif(trim(p_club_name), ''), v_club.name),
    coalesce(p_age_category, 'senioren'), nullif(trim(p_season), ''),
    coalesce(v_club.primary_color, '#1F4E79'), coalesce(v_club.secondary_color, '#FFFFFF')
  )
  returning id into v_id;
  perform public.club_audit(p_club_id, 'team.created', null, v_id, jsonb_build_object('name', trim(p_name)));
  return v_id;
end;
$$;

-- Admin: all clubs with their subscription and counts.
create function public.admin_clubs()
returns table (
  id uuid, name text, federation_number text, active boolean, plan_name text,
  license_seats integer, seats_used integer, max_teams integer, active_teams integer,
  members integer, ends_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.federation_number, public.club_is_active(c.id), p.name,
      coalesce(s.license_seats, 0), public.club_seats_used(c.id), s.max_teams,
      (select count(*)::integer from public.teams t where t.club_id = c.id and t.archived_at is null),
      (select count(distinct m.coach_id)::integer from public.club_members m where m.club_id = c.id and m.ended_at is null),
      s.ends_on
    from public.clubs c
    left join public.club_subscriptions s on s.club_id = c.id
    left join public.plans p on p.id = s.plan_id
    order by c.name;
end;
$$;

-- Admin: the teams of a club with their staff.
create function public.admin_club_teams(p_club_id uuid)
returns table (
  id uuid, name text, age_category text, season text, archived boolean,
  federation_team text, federation_divisions text[], staff jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query
    select t.id, t.name, t.age_category, t.season, t.archived_at is not null,
      t.federation_team, t.federation_divisions,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'role', s.role,
          'name', coalesce(c.full_name, c.email)) order by s.role, c.full_name)
        from public.team_staff s join public.coaches c on c.id = s.coach_id
        where s.team_id = t.id and s.ended_at is null
      ), '[]'::jsonb)
    from public.teams t
    where t.club_id = p_club_id
    order by t.archived_at is not null, t.name;
end;
$$;

-- Admin: the people of a club, with their roles and licence.
create function public.admin_club_members(p_club_id uuid)
returns table (
  coach_id uuid, name text, email text, roles text[], license_id uuid,
  license_status text, active boolean, since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query
    select c.id, c.full_name, c.email,
      array_agg(m.role::text order by m.role) filter (where m.ended_at is null),
      (select l.id from public.club_licenses l
        where l.club_id = p_club_id and l.coach_id = c.id order by l.activated_at desc limit 1),
      (select l.status from public.club_licenses l
        where l.club_id = p_club_id and l.coach_id = c.id order by l.activated_at desc limit 1),
      bool_or(m.ended_at is null),
      min(m.started_at)
    from public.club_members m
    join public.coaches c on c.id = m.coach_id
    where m.club_id = p_club_id
    group by c.id, c.full_name, c.email
    order by bool_or(m.ended_at is null) desc, c.full_name;
end;
$$;

-- Admin: import what the club filled in.
--   p_data = {
--     club:  { name, address, contact_name, contact_email, contact_phone, primary_color, secondary_color },
--     teams: [{ name, age_category, season, federation_team, divisions: [..] }],
--     staff: [{ name, role, team, team_role }]
--   }
-- Teams are matched on their name within the club (new ones are created);
-- every staff member gets a new activation code with their name as note.
-- Returns { teams_created, teams_updated, codes: [{ name, role, team, team_role, code }] }.
create function public.admin_import_club(p_club_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club jsonb := coalesce(p_data->'club', '{}'::jsonb);
  v_team jsonb;
  v_staff jsonb;
  v_team_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_codes jsonb := '[]'::jsonb;
  v_code record;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'club not found' using errcode = 'P0002';
  end if;
  if jsonb_array_length(coalesce(p_data->'teams', '[]')) > 100
     or jsonb_array_length(coalesce(p_data->'staff', '[]')) > 300 then
    raise exception 'too many rows' using errcode = 'check_violation';
  end if;

  update public.clubs c set
    name = coalesce(nullif(trim(v_club->>'name'), ''), c.name),
    address = coalesce(nullif(trim(v_club->>'address'), ''), c.address),
    contact_name = coalesce(nullif(trim(v_club->>'contact_name'), ''), c.contact_name),
    contact_email = coalesce(nullif(trim(v_club->>'contact_email'), ''), c.contact_email),
    contact_phone = coalesce(nullif(trim(v_club->>'contact_phone'), ''), c.contact_phone),
    primary_color = coalesce(nullif(trim(v_club->>'primary_color'), ''), c.primary_color),
    secondary_color = coalesce(nullif(trim(v_club->>'secondary_color'), ''), c.secondary_color)
  where c.id = p_club_id;

  for v_team in select * from jsonb_array_elements(coalesce(p_data->'teams', '[]')) loop
    select t.id into v_team_id from public.teams t
      where t.club_id = p_club_id and lower(trim(t.name)) = lower(trim(v_team->>'name'))
      order by t.archived_at nulls first limit 1;
    if v_team_id is null then
      v_team_id := public.create_club_team(p_club_id, v_team->>'name', null,
        nullif(v_team->>'age_category', ''), v_team->>'season');
      v_created := v_created + 1;
    else
      update public.teams set
        age_category = coalesce(nullif(v_team->>'age_category', ''), age_category),
        season = coalesce(nullif(trim(v_team->>'season'), ''), season)
      where id = v_team_id;
      v_updated := v_updated + 1;
    end if;
    if coalesce(trim(v_team->>'federation_team'), '') <> '' then
      update public.teams set
        federation_team = trim(v_team->>'federation_team'),
        federation_divisions = coalesce(
          (select array_agg(trim(d)) from jsonb_array_elements_text(coalesce(v_team->'divisions', '[]')) d
           where trim(d) <> ''), '{}')
      where id = v_team_id;
    end if;
  end loop;

  for v_staff in select * from jsonb_array_elements(coalesce(p_data->'staff', '[]')) loop
    v_team_id := null;
    if coalesce(trim(v_staff->>'team'), '') <> '' then
      select t.id into v_team_id from public.teams t
        where t.club_id = p_club_id and t.archived_at is null
          and lower(trim(t.name)) = lower(trim(v_staff->>'team'))
        limit 1;
      if v_team_id is null then
        raise exception 'unknown team %', v_staff->>'team' using errcode = 'check_violation';
      end if;
    end if;
    select * into v_code from public.create_club_activation_code(
      p_club_id,
      (v_staff->>'role')::public.club_role,
      null,
      v_team_id,
      case when v_team_id is null then null else nullif(v_staff->>'team_role', '') end,
      left(trim(v_staff->>'name'), 120)
    );
    v_codes := v_codes || jsonb_build_object(
      'name', trim(v_staff->>'name'), 'role', v_staff->>'role',
      'team', case when v_team_id is null then null else trim(v_staff->>'team') end,
      'team_role', case when v_team_id is null then null else v_staff->>'team_role' end,
      'code', v_code.code);
  end loop;

  perform public.club_audit(p_club_id, 'club.imported', null, null, jsonb_build_object(
    'teams_created', v_created, 'teams_updated', v_updated, 'codes', jsonb_array_length(v_codes)));
  return jsonb_build_object('teams_created', v_created, 'teams_updated', v_updated, 'codes', v_codes);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function
  public.admin_save_federation_clubs(jsonb),
  public.admin_federation_clubs(),
  public.admin_create_club(text, text),
  public.admin_update_club(uuid, text, text, text, text, text, text, text, text),
  public.admin_clubs(),
  public.admin_club_teams(uuid),
  public.admin_club_members(uuid),
  public.admin_import_club(uuid, jsonb)
  from anon, public;

grant execute on function
  public.admin_save_federation_clubs(jsonb),
  public.admin_federation_clubs(),
  public.admin_create_club(text, text),
  public.admin_update_club(uuid, text, text, text, text, text, text, text, text),
  public.admin_clubs(),
  public.admin_club_teams(uuid),
  public.admin_club_members(uuid),
  public.admin_import_club(uuid, jsonb)
  to authenticated;
