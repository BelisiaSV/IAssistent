-- =============================================================================
-- IAssistent — fase 1: fundering
-- Coaches, clubs, teams (met branding), memberships, visieprofiel, spelers,
-- feature flags, team-logo storage. Row Level Security op alle tabellen.
--
-- Toegangsmodel (samengevat, zie CLAUDE.md):
--   * Alleen coaches en clubowners loggen in; elke ingelogde gebruiker heeft een rij in `coaches`.
--   * Een team heeft precies één hoofdcoach (teams.head_coach_id). Die schrijft.
--   * Een hoofdcoach kan een menselijke T2 tijdelijk leestoegang geven
--     (memberships.role = 'assistant_coach' met verplichte einddatum).
--   * Clubowners zien de teams en spelers van hun club.
--   * Het visieprofiel is persoonlijk; delen kan alleen expliciet via coach_profile_shares.
--   * Een gearchiveerd team blijft leesbaar voor de coach, maar is read-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.membership_role as enum ('club_owner', 'assistant_coach');
create type public.player_status as enum ('available', 'injured', 'suspended', 'unavailable');

-- -----------------------------------------------------------------------------
-- Generic triggers
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Every logged-in user (coach or club owner). Created by a trigger on auth.users.
create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The coach's vision. Belongs to the coach, not to a team, so it moves with
-- the coach on a transfer. Football content is data here, never code.
create table public.coach_profiles (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  vision_summary text,
  vision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicit consent to share a vision with one coach or with a club.
create table public.coach_profile_shares (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  shared_with_coach_id uuid references public.coaches (id) on delete cascade,
  shared_with_club_id uuid,
  created_at timestamptz not null default now(),
  constraint coach_profile_shares_one_target check (
    num_nonnulls(shared_with_coach_id, shared_with_club_id) = 1
  ),
  constraint coach_profile_shares_not_self check (shared_with_coach_id is distinct from coach_id)
);

-- Optional: a club that buys licences and assigns coaches to teams.
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  -- Number of active (non-archived) teams the club may have. Only changed by
  -- the backend (service role) when licences are bought.
  license_seats integer not null default 0 check (license_seats >= 0),
  created_by uuid not null default auth.uid() references public.coaches (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_profile_shares
  add constraint coach_profile_shares_shared_with_club_id_fkey
  foreign key (shared_with_club_id) references public.clubs (id) on delete cascade;

-- A team with its own branding. On a transfer the coach archives the team
-- and creates a new one with new branding.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  head_coach_id uuid not null references public.coaches (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  season text check (season is null or length(season) <= 20),
  -- Branding
  club_name text not null check (length(trim(club_name)) between 1 and 120),
  logo_path text,
  primary_color text not null default '#1F4E79' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#FFFFFF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_head_coach_id_idx on public.teams (head_coach_id);
create index teams_club_id_idx on public.teams (club_id);

-- Roles of a coach towards a club or a team (besides being head coach).
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  role public.membership_role not null,
  club_id uuid references public.clubs (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint memberships_shape check (
    (role = 'club_owner' and club_id is not null and team_id is null)
    or (
      role = 'assistant_coach' and team_id is not null and club_id is null
      -- Temporary access for a human T2: an end date is mandatory.
      and valid_until is not null and valid_until > valid_from
    )
  )
);

create unique index memberships_club_owner_unique
  on public.memberships (coach_id, club_id) where role = 'club_owner';
create index memberships_coach_id_idx on public.memberships (coach_id);
create index memberships_team_id_idx on public.memberships (team_id);
create index memberships_club_id_idx on public.memberships (club_id);

-- Players are data within a team; they never log in.
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  last_name text not null check (length(trim(last_name)) between 1 and 80),
  shirt_number smallint check (shirt_number between 1 and 99),
  position text check (position is null or length(position) <= 40),
  birth_year smallint check (birth_year between 1940 and 2020),
  status public.player_status not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_team_id_idx on public.players (team_id);

-- Feature flags per coach or per club. Managed by the backend only.
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  enabled boolean not null default false,
  coach_id uuid references public.coaches (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete cascade,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_flags_one_scope check (num_nonnulls(coach_id, club_id) = 1)
);

create unique index feature_flags_coach_key_unique
  on public.feature_flags (key, coach_id) where coach_id is not null;
create unique index feature_flags_club_key_unique
  on public.feature_flags (key, club_id) where club_id is not null;

create unique index coach_profile_shares_coach_unique
  on public.coach_profile_shares (coach_id, shared_with_coach_id) where shared_with_coach_id is not null;
create unique index coach_profile_shares_club_unique
  on public.coach_profile_shares (coach_id, shared_with_club_id) where shared_with_club_id is not null;

create trigger coaches_set_updated_at before update on public.coaches
  for each row execute function public.set_updated_at();
create trigger coach_profiles_set_updated_at before update on public.coach_profiles
  for each row execute function public.set_updated_at();
create trigger clubs_set_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger players_set_updated_at before update on public.players
  for each row execute function public.set_updated_at();
create trigger feature_flags_set_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Access helpers (security definer, so policies don't recurse into each other)
-- -----------------------------------------------------------------------------
create function public.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.club_id = p_club_id
      and m.coach_id = (select auth.uid())
      and m.role = 'club_owner'
  );
$$;

create function public.is_team_head_coach(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.head_coach_id = (select auth.uid())
  );
$$;

-- Temporary T2 access that is active right now.
create function public.has_assistant_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = p_team_id
      and m.coach_id = (select auth.uid())
      and m.role = 'assistant_coach'
      and now() >= m.valid_from
      and now() < m.valid_until
  );
$$;

-- Read access to a team and everything in it (also when archived).
create function public.can_read_team(p_team_id uuid)
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
      where t.id = p_team_id and t.club_id is not null and public.is_club_owner(t.club_id)
    );
$$;

-- Write access to a team's data: only the head coach, and only while not archived.
create function public.can_write_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and t.head_coach_id = (select auth.uid())
      and t.archived_at is null
  );
$$;

create function public.can_read_coach_profile(p_coach_id uuid)
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
          or (s.shared_with_club_id is not null and public.is_club_owner(s.shared_with_club_id))
        )
    );
$$;

-- Coaches you work with: yourself, the head coach of a team you can read,
-- the T2s of your teams, and the coaches who share their vision with you.
create function public.can_see_coach(p_coach_id uuid)
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
    or public.can_read_coach_profile(p_coach_id);
$$;

-- Club visible to its owners and to head coaches of its teams.
create function public.can_see_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_club_owner(p_club_id)
    or exists (
      select 1 from public.teams t
      where t.club_id = p_club_id and t.head_coach_id = (select auth.uid())
    );
$$;

-- Is a feature flag enabled for the current user?
-- A coach-level flag wins; otherwise the flag of any club the user owns or
-- coaches an active team in.
create function public.is_feature_enabled(p_key text)
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
        and (
          public.is_club_owner(f.club_id)
          or exists (
            select 1 from public.teams t
            where t.club_id = f.club_id
              and t.head_coach_id = (select auth.uid())
              and t.archived_at is null
          )
        )
    )
  );
$$;

-- Team id from a storage path "<team_id>/<file>", or null if it isn't one.
create function public.team_id_from_storage_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- -----------------------------------------------------------------------------
-- Business-rule triggers
-- -----------------------------------------------------------------------------

-- New auth user -> coach row + empty vision profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coaches (id, email, full_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  insert into public.coach_profiles (coach_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep coaches.email in sync when the user changes it.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.coaches set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Creator of a club becomes its owner.
create function public.handle_new_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memberships (coach_id, role, club_id, granted_by)
  values (new.created_by, 'club_owner', new.id, new.created_by);
  return new;
end;
$$;

create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();

-- The head coach and club of a team never change. A team (with all the
-- training material made for it) stays with its coach; a transfer means
-- archiving the team and creating a new one.
create function public.prevent_team_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.head_coach_id is distinct from old.head_coach_id
     or new.club_id is distinct from old.club_id then
    raise exception 'head_coach_id and club_id of a team cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger teams_prevent_owner_change
  before update on public.teams
  for each row execute function public.prevent_team_owner_change();

-- Club teams may not exceed the club's licence seats (active teams only).
create function public.enforce_club_license_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seats integer;
  v_active integer;
begin
  if new.club_id is null or new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null then
    return new; -- was already active, nothing changes
  end if;

  select license_seats into v_seats from public.clubs where id = new.club_id for update;
  select count(*) into v_active
    from public.teams
    where club_id = new.club_id and archived_at is null and id <> new.id;

  if v_active >= v_seats then
    raise exception 'club has no free license seats'
      using errcode = 'check_violation', hint = 'license_seats_exhausted';
  end if;
  return new;
end;
$$;

create trigger teams_enforce_license_seats
  before insert or update of archived_at on public.teams
  for each row execute function public.enforce_club_license_seats();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.coaches enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coach_profile_shares enable row level security;
alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.players enable row level security;
alter table public.feature_flags enable row level security;

-- Nothing is readable without logging in.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- coaches
create policy "coaches: read colleagues" on public.coaches
  for select to authenticated using (public.can_see_coach(id));
create policy "coaches: update self" on public.coaches
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete on public.coaches from authenticated;
revoke update on public.coaches from authenticated;
grant update (full_name) on public.coaches to authenticated;

-- coach_profiles
create policy "coach_profiles: read own or shared" on public.coach_profiles
  for select to authenticated using (public.can_read_coach_profile(coach_id));
create policy "coach_profiles: update own" on public.coach_profiles
  for update to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
revoke insert, delete on public.coach_profiles from authenticated;

-- coach_profile_shares: only the coach gives or withdraws consent
create policy "coach_profile_shares: read involved" on public.coach_profile_shares
  for select to authenticated using (
    coach_id = (select auth.uid())
    or shared_with_coach_id = (select auth.uid())
    or (shared_with_club_id is not null and public.is_club_owner(shared_with_club_id))
  );
create policy "coach_profile_shares: coach shares" on public.coach_profile_shares
  for insert to authenticated with check (coach_id = (select auth.uid()));
create policy "coach_profile_shares: coach withdraws" on public.coach_profile_shares
  for delete to authenticated using (coach_id = (select auth.uid()));
revoke update on public.coach_profile_shares from authenticated;

-- clubs
create policy "clubs: read" on public.clubs
  for select to authenticated using (public.can_see_club(id));
create policy "clubs: create" on public.clubs
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "clubs: owner updates" on public.clubs
  for update to authenticated using (public.is_club_owner(id)) with check (public.is_club_owner(id));
revoke delete on public.clubs from authenticated;
revoke update on public.clubs from authenticated;
grant update (name) on public.clubs to authenticated;
revoke insert on public.clubs from authenticated;
grant insert (name, created_by) on public.clubs to authenticated;

-- teams
create policy "teams: read" on public.teams
  for select to authenticated using (public.can_read_team(id));
create policy "teams: create" on public.teams
  for insert to authenticated with check (
    (head_coach_id = (select auth.uid()) and club_id is null)
    or (club_id is not null and public.is_club_owner(club_id))
  );
create policy "teams: head coach or club owner updates" on public.teams
  for update to authenticated
  using (
    head_coach_id = (select auth.uid())
    or (club_id is not null and public.is_club_owner(club_id))
  )
  with check (
    head_coach_id = (select auth.uid())
    or (club_id is not null and public.is_club_owner(club_id))
  );
-- Teams are archived, never deleted by users (training material stays available).
revoke delete on public.teams from authenticated;

-- memberships
create policy "memberships: read" on public.memberships
  for select to authenticated using (
    coach_id = (select auth.uid())
    or (team_id is not null and public.is_team_head_coach(team_id))
    or (club_id is not null and public.is_club_owner(club_id))
  );
-- Head coach grants temporary T2 access on an active team. Club ownership is
-- only created by the club trigger or the backend.
create policy "memberships: head coach grants assistant" on public.memberships
  for insert to authenticated with check (
    role = 'assistant_coach'
    and public.can_write_team(team_id)
    and granted_by = (select auth.uid())
    and coach_id <> (select auth.uid())
  );
create policy "memberships: head coach changes assistant" on public.memberships
  for update to authenticated
  using (role = 'assistant_coach' and public.is_team_head_coach(team_id))
  with check (role = 'assistant_coach' and public.is_team_head_coach(team_id));
create policy "memberships: head coach or assistant ends access" on public.memberships
  for delete to authenticated using (
    role = 'assistant_coach'
    and (public.is_team_head_coach(team_id) or coach_id = (select auth.uid()))
  );
revoke update on public.memberships from authenticated;
grant update (valid_until) on public.memberships to authenticated;

-- players
create policy "players: read" on public.players
  for select to authenticated using (public.can_read_team(team_id));
create policy "players: head coach inserts" on public.players
  for insert to authenticated with check (public.can_write_team(team_id));
create policy "players: head coach updates" on public.players
  for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
create policy "players: head coach deletes" on public.players
  for delete to authenticated using (public.can_write_team(team_id));

-- feature_flags: read-only for users; managed by the backend (service role)
create policy "feature_flags: read own scope" on public.feature_flags
  for select to authenticated using (
    coach_id = (select auth.uid())
    or (club_id is not null and public.can_see_club(club_id))
  );
revoke insert, update, delete on public.feature_flags from authenticated;

-- -----------------------------------------------------------------------------
-- Storage: team logos  (path: <team_id>/<file>)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  false,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "team-logos: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'team-logos'
    and public.can_read_team(public.team_id_from_storage_path(name))
  );
create policy "team-logos: upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'team-logos'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
create policy "team-logos: replace" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'team-logos'
    and public.can_write_team(public.team_id_from_storage_path(name))
  )
  with check (
    bucket_id = 'team-logos'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
create policy "team-logos: delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'team-logos'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
