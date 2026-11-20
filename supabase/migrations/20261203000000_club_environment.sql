-- =============================================================================
-- Club environment, part 1: data model and access (no screens yet).
--
--   * The platform admin creates a club and its subscription (plan, licences,
--     max. teams, modules, period). Clubs are no longer created by users.
--   * People join a club with a personal activation code. Only a hash of the
--     code is stored; the code itself is shown once.
--   * A club role (owner, admin, technical director, team coordinator, coach,
--     assistant coach) is a row in club_members. Owners, technical directors,
--     coaches and assistant coaches use a licence (club_licenses); admins and
--     team coordinators don't.
--   * Club teams have staff (team_staff): head coaches, assistant coaches and
--     coordinators. A coach can be on several teams, a team can have several
--     coaches.
--   * A coach can link his own team to a club (club_team_links); a club
--     owner/admin approves. A linked team stays with the club for good.
--   * Revoking a licence ends the person's club roles and team staff rows.
--     Nothing is deleted: the club keeps reading its teams' history.
--   * Important changes go to club_audit_log.
--   * All writes go through security definer functions; the tables are
--     read-only for users (RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types and module codes
-- -----------------------------------------------------------------------------
create type public.club_role as enum (
  'owner', 'admin', 'technical_director', 'team_coordinator', 'coach', 'assistant_coach'
);

-- Modules a club can have on top of the core (dashboard, structure, licences).
create function public.club_module_codes()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['dna', 'exercises', 'planning', 'evaluations', 'knowledge', 'reports'];
$$;

-- Roles that use a licence seat.
create function public.club_role_uses_license(p_role public.club_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('owner', 'technical_director', 'coach', 'assistant_coach');
$$;

-- -----------------------------------------------------------------------------
-- Plans: default modules of a club plan
-- -----------------------------------------------------------------------------
alter table public.plans
  add column modules text[] not null default '{}'
    check (modules <@ public.club_module_codes());

update public.plans set modules = '{dna,exercises}' where code = 'club-start';
update public.plans set modules = '{dna,exercises,planning,evaluations}' where code = 'club-performance';
update public.plans set modules = '{dna,exercises,planning,evaluations,knowledge,reports}'
  where code in ('club-academy', 'op-maat');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- What a club bought. One row per club; only the platform admin changes it.
create table public.club_subscriptions (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  license_seats integer not null default 0 check (license_seats between 0 and 1000),
  -- null = no limit
  max_teams integer check (max_teams is null or max_teams between 0 and 1000),
  modules text[] not null default '{}' check (modules <@ public.club_module_codes()),
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_subscriptions_period check (ends_on is null or ends_on >= starts_on)
);

-- A licence seat in use by one person.
create table public.club_licenses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  activated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.coaches (id) on delete set null,
  constraint club_licenses_revoked check ((status = 'revoked') = (revoked_at is not null))
);

create unique index club_licenses_active_unique
  on public.club_licenses (club_id, coach_id) where status = 'active';
create index club_licenses_coach_idx on public.club_licenses (coach_id);

-- A role of a person in a club. Ended rows stay as history.
create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  role public.club_role not null,
  license_id uuid references public.club_licenses (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint club_members_license check (
    not public.club_role_uses_license(role) or license_id is not null or ended_at is not null
  )
);

create unique index club_members_active_unique
  on public.club_members (club_id, coach_id, role) where ended_at is null;
create index club_members_coach_idx on public.club_members (coach_id);
create index club_members_club_idx on public.club_members (club_id);

-- Personal activation codes. Only the hash is stored.
create table public.club_activation_codes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  code_hash text not null unique,
  -- Last characters, so the club can recognise a code in the list.
  code_hint text not null check (length(code_hint) between 1 and 8),
  role public.club_role not null,
  -- Optional: the team the person joins, and as what.
  team_id uuid references public.teams (id) on delete set null,
  team_role text check (team_role in ('head_coach', 'assistant_coach', 'coordinator')),
  note text check (note is null or length(note) <= 120),
  expires_at timestamptz,
  status text not null default 'open' check (status in ('open', 'used', 'revoked')),
  created_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references public.coaches (id) on delete set null,
  used_at timestamptz,
  license_id uuid references public.club_licenses (id) on delete set null,
  revoked_at timestamptz,
  constraint club_activation_codes_team check ((team_id is null) = (team_role is null))
);

create index club_activation_codes_club_idx on public.club_activation_codes (club_id);

-- Failed redeem attempts, to slow down guessing.
create table public.club_activation_attempts (
  id bigint generated always as identity primary key,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index club_activation_attempts_coach_idx
  on public.club_activation_attempts (coach_id, attempted_at);

-- Staff of a club team. Ended rows stay as history.
create table public.team_staff (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  role text not null check (role in ('head_coach', 'assistant_coach', 'coordinator')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index team_staff_active_unique
  on public.team_staff (team_id, coach_id, role) where ended_at is null;
create index team_staff_coach_idx on public.team_staff (coach_id);
create index team_staff_club_idx on public.team_staff (club_id);

-- A coach asks to bring his own team into the club.
create table public.club_team_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  requested_by uuid not null references public.coaches (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.coaches (id) on delete set null,
  decided_at timestamptz
);

create unique index club_team_links_pending_unique
  on public.club_team_links (team_id) where status = 'pending';
create index club_team_links_club_idx on public.club_team_links (club_id);

-- History of important changes in a club.
create table public.club_audit_log (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  actor_id uuid references public.coaches (id) on delete set null,
  action text not null check (action ~ '^[a-z_.]{3,60}$'),
  coach_id uuid references public.coaches (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index club_audit_log_club_idx on public.club_audit_log (club_id, created_at desc);

create trigger club_subscriptions_set_updated_at before update on public.club_subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Existing club owners move to club_members; clubs are created by the admin
-- -----------------------------------------------------------------------------
-- Every existing owner gets a licence and an owner role.
insert into public.club_licenses (club_id, coach_id, activated_at)
select distinct on (m.club_id, m.coach_id) m.club_id, m.coach_id, m.created_at
from public.memberships m
where m.role = 'club_owner';

insert into public.club_members (club_id, coach_id, role, license_id, started_at)
select m.club_id, m.coach_id, 'owner', l.id, m.created_at
from public.memberships m
join public.club_licenses l on l.club_id = m.club_id and l.coach_id = m.coach_id
where m.role = 'club_owner';

insert into public.club_subscriptions (club_id, license_seats)
select c.id, c.license_seats from public.clubs c;

delete from public.memberships where role = 'club_owner';

drop trigger on_club_created on public.clubs;
drop function public.handle_new_club();
drop trigger teams_enforce_license_seats on public.teams;
drop function public.enforce_club_license_seats();
alter table public.clubs drop column license_seats;

drop policy "clubs: create" on public.clubs;
revoke insert on public.clubs from authenticated;

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------

-- The current user has one of these roles in the club right now.
create function public.has_club_role(p_club_id uuid, p_roles public.club_role[])
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
      and m.role = any (p_roles)
  );
$$;

-- The current user is an active member of the club (any role).
create function public.is_club_member(p_club_id uuid)
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
  );
$$;

-- Kept for the existing policies: owner of the club.
create or replace function public.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_club_role(p_club_id, '{owner}');
$$;

-- The club's subscription runs today.
create function public.club_is_active(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_subscriptions s
    where s.club_id = p_club_id
      and s.starts_on <= current_date
      and (s.ends_on is null or s.ends_on >= current_date)
  );
$$;

-- The club has this module right now.
create function public.club_has_module(p_club_id uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.club_is_active(p_club_id)
    and exists (
      select 1 from public.club_subscriptions s
      where s.club_id = p_club_id and p_module = any (s.modules)
    );
$$;

-- The current user is on the staff of a club team, in one of these roles,
-- and still a member of the club.
create function public.has_team_staff_role(p_team_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_staff s
    where s.team_id = p_team_id
      and s.coach_id = (select auth.uid())
      and s.ended_at is null
      and s.role = any (p_roles)
      and public.is_club_member(s.club_id)
  );
$$;

-- Head coach: of a personal team the coach who made it; of a club team a head
-- coach on its staff who is still in the club.
create or replace function public.is_team_head_coach(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and (
        (t.club_id is null and t.head_coach_id = (select auth.uid()))
        or (t.club_id is not null and public.has_team_staff_role(t.id, '{head_coach}'))
      )
  );
$$;

-- Read access to a team (also when archived): head coach, active T2, the
-- other staff of a club team, and the club's owner, admin and technical
-- director.
create or replace function public.can_read_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_team_head_coach(p_team_id)
    or public.has_assistant_access(p_team_id)
    or exists (
      select 1 from public.teams t
      where t.id = p_team_id
        and t.club_id is not null
        and (
          public.has_club_role(t.club_id, '{owner,admin,technical_director}')
          or public.has_team_staff_role(t.id, '{assistant_coach,coordinator}')
        )
    );
$$;

-- Write access to a team's data: the head coach, while the team is active.
create or replace function public.can_write_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_team_head_coach(p_team_id)
    and exists (select 1 from public.teams t where t.id = p_team_id and t.archived_at is null);
$$;

-- A club is visible to its active members.
create or replace function public.can_see_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_club_member(p_club_id);
$$;

-- Coaches you work with. On top of the existing rules: the members of a club
-- you manage (also former members, for the history) and the staff of teams
-- you can read.
create or replace function public.can_see_coach(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_coach_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.head_coach_id = p_coach_id and public.can_read_team(t.id)
    )
    or exists (
      select 1 from public.memberships m
      where m.coach_id = p_coach_id
        and m.team_id is not null
        and public.is_team_head_coach(m.team_id)
    )
    or public.can_read_coach_profile(p_coach_id)
    or exists (
      select 1 from public.club_members m
      where m.coach_id = p_coach_id
        and public.has_club_role(m.club_id, '{owner,admin,technical_director,team_coordinator}')
    )
    or exists (
      select 1 from public.team_staff s
      where s.coach_id = p_coach_id and public.can_read_team(s.team_id)
    );
$$;

-- Feature flags: a club flag counts for the club's active members.
create or replace function public.is_feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select f.enabled from public.feature_flags f
      where f.key = p_key and f.coach_id = (select auth.uid())
    ),
    exists (
      select 1 from public.feature_flags f
      where f.key = p_key
        and f.enabled
        and f.club_id is not null
        and public.is_club_member(f.club_id)
    )
  );
$$;

-- Vision shared with a club: readable by the club's owner, admin and
-- technical director.
create or replace function public.can_read_coach_profile(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_coach_id = (select auth.uid())
    or exists (
      select 1 from public.coach_profile_shares s
      where s.coach_id = p_coach_id
        and (
          s.shared_with_coach_id = (select auth.uid())
          or (
            s.shared_with_club_id is not null
            and public.has_club_role(s.shared_with_club_id, '{owner,admin,technical_director}')
          )
        )
    );
$$;

-- -----------------------------------------------------------------------------
-- Business rules on teams
-- -----------------------------------------------------------------------------

-- The head coach of a team never changes. A personal team may join a club
-- once, through an approved link; a club team never leaves its club.
create or replace function public.prevent_team_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.head_coach_id is distinct from old.head_coach_id then
    raise exception 'head_coach_id and club_id of a team cannot be changed'
      using errcode = 'check_violation';
  end if;
  if new.club_id is distinct from old.club_id then
    if old.club_id is null and new.club_id is not null
       and current_setting('iassistent.club_link', true) = new.id::text then
      return new;
    end if;
    raise exception 'head_coach_id and club_id of a team cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A club may have at most max_teams active teams, and only while its
-- subscription runs.
create function public.enforce_club_max_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_active integer;
begin
  if new.club_id is null or new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null and old.club_id is not distinct from new.club_id then
    return new; -- was already an active team of this club
  end if;
  if not public.club_is_active(new.club_id) then
    raise exception 'club is not active'
      using errcode = 'check_violation', hint = 'club_inactive';
  end if;
  select max_teams into v_max from public.club_subscriptions where club_id = new.club_id for update;
  if v_max is null then
    return new;
  end if;
  select count(*) into v_active
    from public.teams
    where club_id = new.club_id and archived_at is null and id <> new.id;
  if v_active >= v_max then
    raise exception 'club has no free team places'
      using errcode = 'check_violation', hint = 'club_max_teams';
  end if;
  return new;
end;
$$;

create trigger teams_enforce_club_max_teams
  before insert or update of archived_at, club_id on public.teams
  for each row execute function public.enforce_club_max_teams();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.club_subscriptions enable row level security;
alter table public.club_licenses enable row level security;
alter table public.club_members enable row level security;
alter table public.club_activation_codes enable row level security;
alter table public.club_activation_attempts enable row level security;
alter table public.team_staff enable row level security;
alter table public.club_team_links enable row level security;
alter table public.club_audit_log enable row level security;

revoke all on public.club_subscriptions, public.club_licenses, public.club_members,
  public.club_activation_codes, public.club_activation_attempts, public.team_staff,
  public.club_team_links, public.club_audit_log
  from anon, authenticated, public;

grant select on public.club_subscriptions, public.club_licenses, public.club_members,
  public.team_staff, public.club_team_links, public.club_audit_log
  to authenticated;
-- The hash of a code is never readable.
grant select (id, club_id, code_hint, role, team_id, team_role, note, expires_at, status,
  created_by, created_at, used_by, used_at, license_id, revoked_at)
  on public.club_activation_codes to authenticated;

create policy "club_subscriptions: members read" on public.club_subscriptions
  for select to authenticated using (public.is_club_member(club_id) or public.is_platform_admin());

create policy "club_licenses: own or managers" on public.club_licenses
  for select to authenticated using (
    coach_id = (select auth.uid())
    or public.has_club_role(club_id, '{owner,admin}')
    or public.is_platform_admin()
  );

create policy "club_members: own or managers" on public.club_members
  for select to authenticated using (
    coach_id = (select auth.uid())
    or public.has_club_role(club_id, '{owner,admin,technical_director,team_coordinator}')
    or public.is_platform_admin()
  );

create policy "club_activation_codes: managers" on public.club_activation_codes
  for select to authenticated using (
    public.has_club_role(club_id, '{owner,admin}') or public.is_platform_admin()
  );

create policy "team_staff: readers of the team" on public.team_staff
  for select to authenticated using (
    coach_id = (select auth.uid())
    or public.can_read_team(team_id)
    or public.has_club_role(club_id, '{owner,admin,technical_director,team_coordinator}')
  );

create policy "club_team_links: requester or managers" on public.club_team_links
  for select to authenticated using (
    requested_by = (select auth.uid())
    or public.has_club_role(club_id, '{owner,admin}')
  );

create policy "club_audit_log: managers" on public.club_audit_log
  for select to authenticated using (
    public.has_club_role(club_id, '{owner,admin}') or public.is_platform_admin()
  );

-- Clubs: active members and the platform admin.
drop policy "clubs: read" on public.clubs;
create policy "clubs: read" on public.clubs
  for select to authenticated using (public.can_see_club(id) or public.is_platform_admin());

-- Teams: a personal team is read back by its coach right after insert (own
-- columns, see CLAUDE.md); everything else through can_read_team.
drop policy "teams: read" on public.teams;
create policy "teams: read" on public.teams
  for select to authenticated using (
    (club_id is null and head_coach_id = (select auth.uid()))
    or public.can_read_team(id)
  );

-- Coaches create personal teams; club teams are made with create_club_team().
drop policy "teams: create" on public.teams;
create policy "teams: create" on public.teams
  for insert to authenticated with check (
    head_coach_id = (select auth.uid()) and club_id is null
  );

-- Personal team: its coach. Club team: its head coach, or the club's owner
-- or admin (names, branding, archiving).
drop policy "teams: head coach or club owner updates" on public.teams;
create policy "teams: head coach or club managers update" on public.teams
  for update to authenticated
  using (
    (club_id is null and head_coach_id = (select auth.uid()))
    or (club_id is not null and (
      public.is_team_head_coach(id) or public.has_club_role(club_id, '{owner,admin}')
    ))
  )
  with check (
    (club_id is null and head_coach_id = (select auth.uid()))
    or (club_id is not null and (
      public.is_team_head_coach(id) or public.has_club_role(club_id, '{owner,admin}')
    ))
  );

-- -----------------------------------------------------------------------------
-- Functions (all writes)
-- -----------------------------------------------------------------------------

create function public.club_audit(
  p_club_id uuid, p_action text, p_coach_id uuid default null,
  p_team_id uuid default null, p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.club_audit_log (club_id, actor_id, action, coach_id, team_id, details)
  values (p_club_id, (select auth.uid()), p_action, p_coach_id, p_team_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Normalised form of a code as typed by a person: letters and digits only.
create function public.club_code_normalize(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function public.club_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(public.club_code_normalize(p_code), 'UTF8')), 'hex');
$$;

-- Platform admin: create a club (inactive until it has a subscription).
create function public.admin_create_club(p_name text)
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
  insert into public.clubs (name, created_by) values (trim(p_name), (select auth.uid()))
  returning id into v_id;
  perform public.club_audit(v_id, 'club.created', null, null, jsonb_build_object('name', trim(p_name)));
  return v_id;
end;
$$;

-- Platform admin: set what a club bought. The modules default to the plan's.
create function public.admin_set_club_subscription(
  p_club_id uuid,
  p_plan_id uuid,
  p_license_seats integer,
  p_max_teams integer,
  p_modules text[],
  p_starts_on date,
  p_ends_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modules text[];
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins change subscriptions' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'club not found' using errcode = 'P0002';
  end if;
  v_modules := coalesce(p_modules, (select modules from public.plans where id = p_plan_id), '{}');
  insert into public.club_subscriptions
    (club_id, plan_id, license_seats, max_teams, modules, starts_on, ends_on)
  values
    (p_club_id, p_plan_id, coalesce(p_license_seats, 0), p_max_teams, v_modules,
     coalesce(p_starts_on, current_date), p_ends_on)
  on conflict (club_id) do update set
    plan_id = excluded.plan_id,
    license_seats = excluded.license_seats,
    max_teams = excluded.max_teams,
    modules = excluded.modules,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;
  perform public.club_audit(p_club_id, 'subscription.set', null, null, jsonb_build_object(
    'plan_id', p_plan_id, 'license_seats', p_license_seats, 'max_teams', p_max_teams,
    'modules', to_jsonb(v_modules), 'starts_on', p_starts_on, 'ends_on', p_ends_on));
end;
$$;

-- Licence seats in use: active licences + open codes that will use one.
create function public.club_seats_used(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.club_licenses l
    where l.club_id = p_club_id and l.status = 'active'
  )::integer + (
    select count(*) from public.club_activation_codes c
    where c.club_id = p_club_id
      and c.status = 'open'
      and (c.expires_at is null or c.expires_at > now())
      and public.club_role_uses_license(c.role)
  )::integer;
$$;

-- Create a personal activation code. Returns the code once.
--   * Platform admin: any role (the first owner of a club).
--   * Owner: any role. Admin: every role except owner and admin.
create function public.create_club_activation_code(
  p_club_id uuid,
  p_role public.club_role,
  p_expires_at timestamptz default null,
  p_team_id uuid default null,
  p_team_role text default null,
  p_note text default null
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_raw text := '';
  v_code text;
  v_seats integer;
  v_id uuid;
  i integer;
begin
  if not (
    public.is_platform_admin()
    or public.has_club_role(p_club_id, '{owner}')
    or (public.has_club_role(p_club_id, '{admin}') and p_role not in ('owner', 'admin'))
  ) then
    raise exception 'not allowed to create this code' using errcode = '42501';
  end if;
  if not public.club_is_active(p_club_id) then
    raise exception 'club is not active' using errcode = 'check_violation', hint = 'club_inactive';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = 'check_violation';
  end if;
  if p_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.club_id = p_club_id and t.archived_at is null
  ) then
    raise exception 'team is not an active team of the club' using errcode = 'check_violation';
  end if;
  if (p_team_role = 'coordinator' and p_role <> 'team_coordinator')
     or (p_team_role in ('head_coach', 'assistant_coach') and p_role not in ('coach', 'assistant_coach')) then
    raise exception 'team role does not fit the club role' using errcode = 'check_violation';
  end if;
  if public.club_role_uses_license(p_role) then
    select s.license_seats into v_seats
      from public.club_subscriptions s where s.club_id = p_club_id for update;
    if public.club_seats_used(p_club_id) >= coalesce(v_seats, 0) then
      raise exception 'no free licence seats'
        using errcode = 'check_violation', hint = 'license_seats_exhausted';
    end if;
  end if;

  -- 12 characters from a 32-character alphabet (60 random bits).
  v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  for i in 0..11 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);

  insert into public.club_activation_codes
    (club_id, code_hash, code_hint, role, team_id, team_role, note, expires_at, created_by)
  values
    (p_club_id, public.club_code_hash(v_raw), right(v_raw, 4), p_role, p_team_id, p_team_role,
     nullif(trim(p_note), ''), p_expires_at, (select auth.uid()))
  returning club_activation_codes.id into v_id;

  perform public.club_audit(p_club_id, 'code.created', null, p_team_id,
    jsonb_build_object('code_id', v_id, 'role', p_role, 'hint', right(v_raw, 4), 'team_role', p_team_role));
  return query select v_id, v_code;
end;
$$;

-- Withdraw a code that was not used yet.
create function public.revoke_club_activation_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.club_activation_codes;
begin
  select * into v_code from public.club_activation_codes where id = p_code_id for update;
  if not found or not (
    public.is_platform_admin()
    or public.has_club_role(v_code.club_id, '{owner}')
    or (public.has_club_role(v_code.club_id, '{admin}') and v_code.role not in ('owner', 'admin'))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_code.status <> 'open' then
    raise exception 'code is not open' using errcode = 'check_violation';
  end if;
  update public.club_activation_codes set status = 'revoked', revoked_at = now() where id = p_code_id;
  perform public.club_audit(v_code.club_id, 'code.revoked', null, null,
    jsonb_build_object('code_id', p_code_id, 'hint', v_code.code_hint));
end;
$$;

-- The current user redeems a code. Returns { ok, club_id } or { ok: false, error }.
-- Errors: too_many_attempts, invalid, expired, club_inactive, already_member,
-- no_seats.
create function public.redeem_club_activation_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code public.club_activation_codes;
  v_license uuid;
  v_seats integer;
  v_active integer;
begin
  if v_uid is null then
    raise exception 'not logged in' using errcode = '42501';
  end if;
  if (
    select count(*) from public.club_activation_attempts a
    where a.coach_id = v_uid and a.attempted_at > now() - interval '1 hour'
  ) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into v_code from public.club_activation_codes
    where code_hash = public.club_code_hash(p_code)
    for update;
  if not found or v_code.status <> 'open' then
    insert into public.club_activation_attempts (coach_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if not public.club_is_active(v_code.club_id) then
    return jsonb_build_object('ok', false, 'error', 'club_inactive');
  end if;
  if exists (
    select 1 from public.club_members m
    where m.club_id = v_code.club_id and m.coach_id = v_uid and m.role = v_code.role and m.ended_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_member');
  end if;

  if public.club_role_uses_license(v_code.role) then
    select l.id into v_license from public.club_licenses l
      where l.club_id = v_code.club_id and l.coach_id = v_uid and l.status = 'active';
    if v_license is null then
      -- The code reserved a seat; check again in case the club has fewer now.
      select s.license_seats into v_seats
        from public.club_subscriptions s where s.club_id = v_code.club_id for update;
      select count(*) into v_active from public.club_licenses l
        where l.club_id = v_code.club_id and l.status = 'active';
      if v_active >= coalesce(v_seats, 0) then
        return jsonb_build_object('ok', false, 'error', 'no_seats');
      end if;
      insert into public.club_licenses (club_id, coach_id) values (v_code.club_id, v_uid)
        returning id into v_license;
      perform public.club_audit(v_code.club_id, 'license.activated', v_uid, null,
        jsonb_build_object('license_id', v_license));
    end if;
  end if;

  insert into public.club_members (club_id, coach_id, role, license_id)
  values (v_code.club_id, v_uid, v_code.role, v_license);

  if v_code.team_id is not null and exists (
    select 1 from public.teams t where t.id = v_code.team_id and t.club_id = v_code.club_id
  ) and not exists (
    select 1 from public.team_staff s
    where s.team_id = v_code.team_id and s.coach_id = v_uid and s.role = v_code.team_role and s.ended_at is null
  ) then
    insert into public.team_staff (team_id, club_id, coach_id, role)
    values (v_code.team_id, v_code.club_id, v_uid, v_code.team_role);
  end if;

  update public.club_activation_codes
    set status = 'used', used_by = v_uid, used_at = now(), license_id = v_license
    where id = v_code.id;
  perform public.club_audit(v_code.club_id, 'code.redeemed', v_uid, v_code.team_id,
    jsonb_build_object('code_id', v_code.id, 'role', v_code.role, 'team_role', v_code.team_role));
  return jsonb_build_object('ok', true, 'club_id', v_code.club_id);
end;
$$;

-- Revoke a licence: the person loses every role and team place in the club.
-- The club keeps all history. The seat is free again.
create function public.revoke_club_license(p_license_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_license public.club_licenses;
begin
  select * into v_license from public.club_licenses where id = p_license_id for update;
  if not found or not (
    public.is_platform_admin()
    or public.has_club_role(v_license.club_id, '{owner}')
    or (
      public.has_club_role(v_license.club_id, '{admin}')
      and not exists (
        select 1 from public.club_members m
        where m.club_id = v_license.club_id and m.coach_id = v_license.coach_id
          and m.ended_at is null and m.role in ('owner', 'admin')
      )
    )
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_license.status <> 'active' then
    raise exception 'licence is not active' using errcode = 'check_violation';
  end if;
  update public.club_licenses
    set status = 'revoked', revoked_at = now(), revoked_by = (select auth.uid())
    where id = p_license_id;
  update public.club_members set ended_at = now()
    where club_id = v_license.club_id and coach_id = v_license.coach_id and ended_at is null;
  update public.team_staff set ended_at = now()
    where club_id = v_license.club_id and coach_id = v_license.coach_id and ended_at is null;
  perform public.club_audit(v_license.club_id, 'license.revoked', v_license.coach_id, null,
    jsonb_build_object('license_id', p_license_id));
end;
$$;

-- End a role without a licence (admin, team coordinator).
create function public.end_club_role(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.club_members;
begin
  select * into v_member from public.club_members where id = p_member_id for update;
  if not found or not (
    public.is_platform_admin()
    or public.has_club_role(v_member.club_id, '{owner}')
    or (public.has_club_role(v_member.club_id, '{admin}') and v_member.role not in ('owner', 'admin'))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if public.club_role_uses_license(v_member.role) then
    raise exception 'revoke the licence to end this role' using errcode = 'check_violation';
  end if;
  if v_member.ended_at is not null then
    return;
  end if;
  update public.club_members set ended_at = now() where id = p_member_id;
  if v_member.role = 'team_coordinator' then
    update public.team_staff set ended_at = now()
      where club_id = v_member.club_id and coach_id = v_member.coach_id
        and role = 'coordinator' and ended_at is null;
  end if;
  perform public.club_audit(v_member.club_id, 'role.ended', v_member.coach_id, null,
    jsonb_build_object('role', v_member.role));
end;
$$;

-- Owner or admin: create a club team. The creator is recorded as head_coach_id
-- (the team's maker); who coaches it is in team_staff.
create function public.create_club_team(
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
begin
  if not public.has_club_role(p_club_id, '{owner,admin}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.teams (head_coach_id, club_id, name, club_name, age_category, season)
  values ((select auth.uid()), p_club_id, trim(p_name), trim(p_club_name), coalesce(p_age_category, 'senioren'), nullif(trim(p_season), ''))
  returning id into v_id;
  perform public.club_audit(p_club_id, 'team.created', null, v_id, jsonb_build_object('name', trim(p_name)));
  return v_id;
end;
$$;

-- Owner or admin: put a member on the staff of a club team.
create function public.assign_team_staff(p_team_id uuid, p_coach_id uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
  v_id uuid;
begin
  select club_id into v_club from public.teams where id = p_team_id and archived_at is null;
  if v_club is null or not public.has_club_role(v_club, '{owner,admin}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('head_coach', 'assistant_coach', 'coordinator') then
    raise exception 'unknown team role' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.club_members m
    where m.club_id = v_club and m.coach_id = p_coach_id and m.ended_at is null
      and (
        (p_role = 'coordinator' and m.role = 'team_coordinator')
        or (p_role in ('head_coach', 'assistant_coach') and m.role in ('coach', 'assistant_coach'))
      )
  ) then
    raise exception 'person has no fitting role in the club'
      using errcode = 'check_violation', hint = 'no_club_role';
  end if;
  select id into v_id from public.team_staff
    where team_id = p_team_id and coach_id = p_coach_id and role = p_role and ended_at is null;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.team_staff (team_id, club_id, coach_id, role)
  values (p_team_id, v_club, p_coach_id, p_role)
  returning id into v_id;
  perform public.club_audit(v_club, 'staff.assigned', p_coach_id, p_team_id, jsonb_build_object('role', p_role));
  return v_id;
end;
$$;

-- Owner or admin: take someone off a team's staff.
create function public.end_team_staff(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.team_staff;
begin
  select * into v_staff from public.team_staff where id = p_staff_id for update;
  if not found or not public.has_club_role(v_staff.club_id, '{owner,admin}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_staff.ended_at is not null then
    return;
  end if;
  update public.team_staff set ended_at = now() where id = p_staff_id;
  perform public.club_audit(v_staff.club_id, 'staff.ended', v_staff.coach_id, v_staff.team_id,
    jsonb_build_object('role', v_staff.role));
end;
$$;

-- A coach of the club asks to bring his own active team into the club.
create function public.request_club_team_link(p_team_id uuid, p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.club_id is null and t.archived_at is null
      and t.head_coach_id = (select auth.uid())
  ) then
    raise exception 'only the coach of an active personal team can link it' using errcode = '42501';
  end if;
  if not public.has_club_role(p_club_id, '{coach,assistant_coach}') then
    raise exception 'not a coach of this club' using errcode = '42501';
  end if;
  insert into public.club_team_links (club_id, team_id, requested_by)
  values (p_club_id, p_team_id, (select auth.uid()))
  returning id into v_id;
  perform public.club_audit(p_club_id, 'team_link.requested', (select auth.uid()), p_team_id);
  return v_id;
end;
$$;

-- The requester withdraws a pending request.
create function public.cancel_club_team_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.club_team_links;
begin
  select * into v_link from public.club_team_links where id = p_link_id for update;
  if not found or v_link.requested_by <> (select auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'request is not pending' using errcode = 'check_violation';
  end if;
  update public.club_team_links set status = 'cancelled', decided_at = now() where id = p_link_id;
  perform public.club_audit(v_link.club_id, 'team_link.cancelled', v_link.requested_by, v_link.team_id);
end;
$$;

-- Owner or admin approves or rejects. Approving moves the team into the club
-- for good and makes the requester its head coach on the staff.
create function public.decide_club_team_link(p_link_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.club_team_links;
begin
  select * into v_link from public.club_team_links where id = p_link_id for update;
  if not found or not public.has_club_role(v_link.club_id, '{owner,admin}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'request is not pending' using errcode = 'check_violation';
  end if;
  if not p_approve then
    update public.club_team_links
      set status = 'rejected', decided_by = (select auth.uid()), decided_at = now()
      where id = p_link_id;
    perform public.club_audit(v_link.club_id, 'team_link.rejected', v_link.requested_by, v_link.team_id);
    return;
  end if;
  if not public.has_club_role_of(v_link.club_id, v_link.requested_by, '{coach,assistant_coach}') then
    raise exception 'requester is no longer a coach of the club' using errcode = 'check_violation';
  end if;

  perform set_config('iassistent.club_link', v_link.team_id::text, true);
  update public.teams set club_id = v_link.club_id
    where id = v_link.team_id and club_id is null and archived_at is null;
  if not found then
    perform set_config('iassistent.club_link', '', true);
    raise exception 'team can no longer be linked' using errcode = 'check_violation';
  end if;
  perform set_config('iassistent.club_link', '', true);

  insert into public.team_staff (team_id, club_id, coach_id, role)
  values (v_link.team_id, v_link.club_id, v_link.requested_by, 'head_coach');
  -- T2 access on a personal team ends; in the club, staff is managed by the club.
  delete from public.memberships where team_id = v_link.team_id and role = 'assistant_coach';
  update public.club_team_links
    set status = 'approved', decided_by = (select auth.uid()), decided_at = now()
    where id = p_link_id;
  -- Other pending requests for the same team (other clubs) are void now.
  update public.club_team_links set status = 'rejected', decided_at = now()
    where team_id = v_link.team_id and status = 'pending';
  perform public.club_audit(v_link.club_id, 'team_link.approved', v_link.requested_by, v_link.team_id);
end;
$$;

-- Has a given person one of these roles in the club right now?
create function public.has_club_role_of(p_club_id uuid, p_coach_id uuid, p_roles public.club_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.coach_id = p_coach_id
      and m.ended_at is null and m.role = any (p_roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function
  public.club_module_codes(),
  public.club_role_uses_license(public.club_role),
  public.has_club_role(uuid, public.club_role[]),
  public.has_club_role_of(uuid, uuid, public.club_role[]),
  public.is_club_member(uuid),
  public.club_is_active(uuid),
  public.club_has_module(uuid, text),
  public.has_team_staff_role(uuid, text[]),
  public.enforce_club_max_teams(),
  public.club_audit(uuid, text, uuid, uuid, jsonb),
  public.club_code_normalize(text),
  public.club_code_hash(text),
  public.admin_create_club(text),
  public.admin_set_club_subscription(uuid, uuid, integer, integer, text[], date, date),
  public.club_seats_used(uuid),
  public.create_club_activation_code(uuid, public.club_role, timestamptz, uuid, text, text),
  public.revoke_club_activation_code(uuid),
  public.redeem_club_activation_code(text),
  public.revoke_club_license(uuid),
  public.end_club_role(uuid),
  public.create_club_team(uuid, text, text, text, text),
  public.assign_team_staff(uuid, uuid, text),
  public.end_team_staff(uuid),
  public.request_club_team_link(uuid, uuid),
  public.cancel_club_team_link(uuid),
  public.decide_club_team_link(uuid, boolean)
  from anon, public;

grant execute on function
  public.club_module_codes(),
  public.club_role_uses_license(public.club_role),
  public.has_club_role(uuid, public.club_role[]),
  public.is_club_member(uuid),
  public.club_is_active(uuid),
  public.club_has_module(uuid, text),
  public.has_team_staff_role(uuid, text[]),
  public.club_seats_used(uuid),
  public.admin_create_club(text),
  public.admin_set_club_subscription(uuid, uuid, integer, integer, text[], date, date),
  public.create_club_activation_code(uuid, public.club_role, timestamptz, uuid, text, text),
  public.revoke_club_activation_code(uuid),
  public.redeem_club_activation_code(text),
  public.revoke_club_license(uuid),
  public.end_club_role(uuid),
  public.create_club_team(uuid, text, text, text, text),
  public.assign_team_staff(uuid, uuid, text),
  public.end_team_staff(uuid),
  public.request_club_team_link(uuid, uuid),
  public.cancel_club_team_link(uuid),
  public.decide_club_team_link(uuid, boolean)
  to authenticated;
