-- =============================================================================
-- Club self-service
--   * Owner and admin are one role for the club: "Clubbeheerder". Wherever a
--     check asks for owner or admin, both count (has_club_role).
--   * Invitations by e-mail (club_invitations): the club manager (or the
--     platform admin) lists a person with a role and teams. Whoever logs in
--     with that confirmed e-mail joins automatically (accept_club_invitations);
--     a person who already has an account joins at once. Codes stay as a
--     fallback.
--   * The club file (import_club_file): teams (name, category, team in the
--     competition export) and people (name, e-mail, role, team). Uploading it
--     again updates; nobody is removed.
--   * A pending invitation for a role with a licence reserves a seat.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Owner and admin are one role
-- -----------------------------------------------------------------------------
create or replace function public.has_club_role(p_club_id uuid, p_roles public.club_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id
      and m.coach_id = (select auth.uid())
      and m.ended_at is null
      and (
        m.role = any (p_roles)
        or (m.role in ('owner', 'admin') and p_roles && '{owner,admin}'::public.club_role[])
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  name text check (name is null or length(name) <= 120),
  roles public.club_role[] not null default '{}',
  -- [{ team_id, role: head_coach | assistant_coach | coordinator }]
  teams jsonb not null default '[]'::jsonb check (jsonb_typeof(teams) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_by uuid references public.coaches (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index club_invitations_pending_unique
  on public.club_invitations (club_id, email) where status = 'pending';
create index club_invitations_email_idx on public.club_invitations (email) where status = 'pending';

alter table public.club_invitations enable row level security;
revoke all on public.club_invitations from anon, authenticated, public;
grant select on public.club_invitations to authenticated;

create policy club_invitations_select on public.club_invitations
  for select to authenticated
  using (public.has_club_role(club_id, '{owner,admin}') or public.is_platform_admin());

-- Seats: licences in use, open codes and pending invitations for a role with a licence.
create or replace function public.club_seats_used(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (public.is_club_member(p_club_id) or public.is_platform_admin()) then 0 else (
    select count(*) from public.club_licenses l
    where l.club_id = p_club_id and l.status = 'active'
  )::integer + (
    select count(*) from public.club_activation_codes c
    where c.club_id = p_club_id
      and c.status = 'open'
      and (c.expires_at is null or c.expires_at > now())
      and public.club_role_uses_license(c.role)
  )::integer + (
    select count(*) from public.club_invitations i
    where i.club_id = p_club_id
      and i.status = 'pending'
      and exists (select 1 from unnest(i.roles) r where public.club_role_uses_license(r))
  )::integer end;
$$;

-- Applies a pending invitation to a person: licence, roles and team places.
-- Returns null when done, otherwise the reason (invalid, club_inactive, no_seats).
create function public.club_apply_invitation(p_id uuid, p_coach_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.club_invitations;
  v_license uuid;
  v_seats integer;
  v_active integer;
  v_role public.club_role;
  v_team jsonb;
begin
  select * into v from public.club_invitations where id = p_id and status = 'pending' for update;
  if not found then
    return 'invalid';
  end if;
  if not public.club_is_active(v.club_id) then
    return 'club_inactive';
  end if;

  if exists (select 1 from unnest(v.roles) r where public.club_role_uses_license(r)) then
    select l.id into v_license from public.club_licenses l
      where l.club_id = v.club_id and l.coach_id = p_coach_id and l.status = 'active';
    if v_license is null then
      select s.license_seats into v_seats
        from public.club_subscriptions s where s.club_id = v.club_id for update;
      select count(*) into v_active from public.club_licenses l
        where l.club_id = v.club_id and l.status = 'active';
      if v_active >= coalesce(v_seats, 0) then
        return 'no_seats';
      end if;
      insert into public.club_licenses (club_id, coach_id) values (v.club_id, p_coach_id)
        returning id into v_license;
      perform public.club_audit(v.club_id, 'license.activated', p_coach_id, null,
        jsonb_build_object('license_id', v_license));
    end if;
  end if;

  foreach v_role in array v.roles loop
    if not exists (
      select 1 from public.club_members m
      where m.club_id = v.club_id and m.coach_id = p_coach_id and m.role = v_role and m.ended_at is null
    ) then
      insert into public.club_members (club_id, coach_id, role, license_id)
      values (v.club_id, p_coach_id, v_role,
        case when public.club_role_uses_license(v_role) then v_license end);
    end if;
  end loop;

  for v_team in select * from jsonb_array_elements(v.teams) loop
    if exists (
      select 1 from public.teams t
      where t.id = (v_team->>'team_id')::uuid and t.club_id = v.club_id and t.archived_at is null
    ) and not exists (
      select 1 from public.team_staff s
      where s.team_id = (v_team->>'team_id')::uuid and s.coach_id = p_coach_id
        and s.role = v_team->>'role' and s.ended_at is null
    ) then
      insert into public.team_staff (team_id, club_id, coach_id, role)
      values ((v_team->>'team_id')::uuid, v.club_id, p_coach_id, v_team->>'role');
    end if;
  end loop;

  update public.club_invitations
    set status = 'accepted', accepted_by = p_coach_id, accepted_at = now(), updated_at = now()
    where id = p_id;
  perform public.club_audit(v.club_id, 'invitation.accepted', p_coach_id, null,
    jsonb_build_object('invitation_id', p_id, 'roles', v.roles));
  return null;
end;
$$;

-- Adds a person to the club's invitations (one per e-mail while pending; a
-- second role or team is added to it). A person with an account joins at
-- once. p_role: club_manager, technical_director, coordinator, head_coach,
-- assistant_coach. Returns 'added' (joined now) or 'invited'.
-- No rights check: only called by the functions below.
create function public.club_invite_person(
  p_club_id uuid, p_email text, p_name text, p_role text, p_team_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role public.club_role;
  v_team_role text;
  v_id uuid;
  v_uid uuid;
  v_entry jsonb;
  v_error text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'invalid e-mail' using errcode = 'check_violation', hint = 'invalid_email';
  end if;
  case p_role
    when 'club_manager' then v_role := 'admin';
    when 'technical_director' then v_role := 'technical_director';
    when 'coordinator' then v_role := 'team_coordinator'; v_team_role := 'coordinator';
    when 'head_coach' then v_role := 'coach'; v_team_role := 'head_coach';
    when 'assistant_coach' then v_role := 'assistant_coach'; v_team_role := 'assistant_coach';
    else raise exception 'unknown role' using errcode = 'check_violation', hint = 'invalid_role';
  end case;
  if p_team_id is not null then
    if v_team_role is null then
      raise exception 'this role has no team' using errcode = 'check_violation', hint = 'role_without_team';
    end if;
    if not exists (
      select 1 from public.teams t where t.id = p_team_id and t.club_id = p_club_id and t.archived_at is null
    ) then
      raise exception 'team is not an active team of the club' using errcode = 'check_violation', hint = 'unknown_team';
    end if;
    v_entry := jsonb_build_object('team_id', p_team_id, 'role', v_team_role);
  end if;

  select id into v_id from public.club_invitations
    where club_id = p_club_id and email = v_email and status = 'pending' for update;
  if v_id is null then
    insert into public.club_invitations (club_id, email, name, created_by)
    values (p_club_id, v_email, nullif(left(trim(coalesce(p_name, '')), 120), ''), (select auth.uid()))
    returning id into v_id;
    perform public.club_audit(p_club_id, 'invitation.created', null, p_team_id,
      jsonb_build_object('invitation_id', v_id, 'role', v_role));
  end if;
  update public.club_invitations i set
    name = coalesce(nullif(left(trim(coalesce(p_name, '')), 120), ''), i.name),
    roles = case when v_role = any (i.roles) then i.roles else i.roles || v_role end,
    teams = case when v_entry is null or i.teams @> jsonb_build_array(v_entry) then i.teams else i.teams || jsonb_build_array(v_entry) end,
    updated_at = now()
  where i.id = v_id;

  select u.id into v_uid from auth.users u
    where lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;
  if v_uid is not null and exists (select 1 from public.coaches c where c.id = v_uid) then
    v_error := public.club_apply_invitation(v_id, v_uid);
    if v_error = 'no_seats' then
      raise exception 'no free licence seats' using errcode = 'check_violation', hint = 'license_seats_exhausted';
    end if;
    if v_error is null then
      return 'added';
    end if;
  end if;
  return 'invited';
end;
$$;

-- Raises when the club uses more seats than it has.
create function public.club_check_seats(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seats integer;
begin
  select s.license_seats into v_seats from public.club_subscriptions s where s.club_id = p_club_id;
  if public.club_seats_used(p_club_id) > coalesce(v_seats, 0) then
    raise exception 'no free licence seats' using errcode = 'check_violation', hint = 'license_seats_exhausted';
  end if;
end;
$$;

-- Club manager or platform admin: invite one person.
create function public.save_club_invitation(
  p_club_id uuid, p_email text, p_name text, p_role text, p_team_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result text;
begin
  if not (public.has_club_role(p_club_id, '{owner,admin}') or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_is_active(p_club_id) then
    raise exception 'club is not active' using errcode = 'check_violation', hint = 'club_inactive';
  end if;
  perform 1 from public.club_subscriptions s where s.club_id = p_club_id for update;
  v_result := public.club_invite_person(p_club_id, p_email, p_name, p_role, p_team_id);
  perform public.club_check_seats(p_club_id);
  return v_result;
end;
$$;

-- Club manager or platform admin: withdraw a pending invitation.
create function public.revoke_club_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from public.club_invitations where id = p_id and status = 'pending';
  if v_club is null or not (public.has_club_role(v_club, '{owner,admin}') or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.club_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
    where id = p_id;
  perform public.club_audit(v_club, 'invitation.revoked', null, null, jsonb_build_object('invitation_id', p_id));
end;
$$;

-- The logged-in person joins every club that invited his confirmed e-mail.
-- Returns the clubs joined.
create function public.accept_club_invitations()
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v record;
  v_joined uuid[] := '{}';
begin
  if v_uid is null then
    return v_joined;
  end if;
  select lower(u.email) into v_email from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return v_joined;
  end if;
  for v in
    select i.id, i.club_id from public.club_invitations i
    where i.email = v_email and i.status = 'pending'
    order by i.created_at
  loop
    if public.club_apply_invitation(v.id, v_uid) is null then
      v_joined := v_joined || v.club_id;
    end if;
  end loop;
  return v_joined;
end;
$$;

-- -----------------------------------------------------------------------------
-- The club file
--   { teams: [{ name, age_category, federation_team }],
--     people: [{ name, email, role, team }] }
-- -----------------------------------------------------------------------------
create function public.import_club_file(p_club_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team jsonb;
  v_person jsonb;
  v_team_id uuid;
  v_divisions text[];
  v_created integer := 0;
  v_updated integer := 0;
  v_invited integer := 0;
  v_added integer := 0;
begin
  if not (public.has_club_role(p_club_id, '{owner,admin}') or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_is_active(p_club_id) then
    raise exception 'club is not active' using errcode = 'check_violation', hint = 'club_inactive';
  end if;
  if jsonb_array_length(coalesce(p_data->'teams', '[]')) > 100
     or jsonb_array_length(coalesce(p_data->'people', '[]')) > 300 then
    raise exception 'too many rows' using errcode = 'check_violation';
  end if;
  perform 1 from public.club_subscriptions s where s.club_id = p_club_id for update;

  for v_team in select * from jsonb_array_elements(coalesce(p_data->'teams', '[]')) loop
    if coalesce(trim(v_team->>'name'), '') = '' or length(trim(v_team->>'name')) > 120 then
      raise exception 'invalid team name' using errcode = 'check_violation';
    end if;
    v_team_id := null;
    select t.id into v_team_id from public.teams t
      where t.club_id = p_club_id and t.archived_at is null
        and lower(trim(t.name)) = lower(trim(v_team->>'name'))
      limit 1;
    if v_team_id is null then
      v_team_id := public.create_club_team(p_club_id, v_team->>'name', null,
        nullif(v_team->>'age_category', ''), null);
      v_created := v_created + 1;
    else
      update public.teams set
        age_category = coalesce(nullif(v_team->>'age_category', ''), age_category)
      where id = v_team_id;
      v_updated := v_updated + 1;
    end if;
    if coalesce(trim(v_team->>'federation_team'), '') <> '' then
      v_divisions := null;
      select f.divisions into v_divisions
        from public.club_federation_teams(p_club_id) f where f.name = trim(v_team->>'federation_team');
      if v_divisions is null then
        raise exception 'unknown team in the competition: %', v_team->>'federation_team'
          using errcode = 'check_violation', hint = 'unknown_federation_team';
      end if;
      perform set_config('iassistent.federation_link', v_team_id::text, true);
      update public.teams
        set federation_team = trim(v_team->>'federation_team'), federation_divisions = v_divisions
        where id = v_team_id
          and (federation_team is distinct from trim(v_team->>'federation_team')
               or federation_divisions is distinct from v_divisions);
      perform set_config('iassistent.federation_link', '', true);
    end if;
  end loop;

  for v_person in select * from jsonb_array_elements(coalesce(p_data->'people', '[]')) loop
    v_team_id := null;
    if coalesce(trim(v_person->>'team'), '') <> '' then
      select t.id into v_team_id from public.teams t
        where t.club_id = p_club_id and t.archived_at is null
          and lower(trim(t.name)) = lower(trim(v_person->>'team'))
        limit 1;
      if v_team_id is null then
        raise exception 'unknown team %', v_person->>'team' using errcode = 'check_violation', hint = 'unknown_team';
      end if;
    end if;
    if public.club_invite_person(p_club_id, v_person->>'email', v_person->>'name',
         v_person->>'role', v_team_id) = 'added' then
      v_added := v_added + 1;
    else
      v_invited := v_invited + 1;
    end if;
  end loop;

  perform public.club_check_seats(p_club_id);
  perform public.club_audit(p_club_id, 'club.file_imported', null, null, jsonb_build_object(
    'teams_created', v_created, 'teams_updated', v_updated, 'invited', v_invited, 'added', v_added));
  return jsonb_build_object('teams_created', v_created, 'teams_updated', v_updated,
    'invited', v_invited, 'added', v_added);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function
  public.club_apply_invitation(uuid, uuid),
  public.club_invite_person(uuid, text, text, text, uuid),
  public.club_check_seats(uuid)
  from anon, authenticated, public;

revoke execute on function
  public.save_club_invitation(uuid, text, text, text, uuid),
  public.revoke_club_invitation(uuid),
  public.accept_club_invitations(),
  public.import_club_file(uuid, jsonb)
  from anon, public;

grant execute on function
  public.save_club_invitation(uuid, text, text, text, uuid),
  public.revoke_club_invitation(uuid),
  public.accept_club_invitations(),
  public.import_club_file(uuid, jsonb)
  to authenticated;
