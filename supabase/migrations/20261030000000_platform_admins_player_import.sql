-- =============================================================================
-- Platform admins and the Excel import of players.
-- Admins are set by hand (SQL) and can import players into any team that is
-- not archived. They do not get general read access: the import goes through
-- security definer functions that check the admin first.
-- =============================================================================

create table public.platform_admins (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies: nobody reads or changes this table through the API.
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.coach_id = (select auth.uid()));
$$;

-- Teams an admin can import into (with the head coach, to pick the right team).
create function public.admin_teams()
returns table (id uuid, name text, club_name text, head_coach_email text, archived boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select t.id, t.name, t.club_name, c.email, t.archived_at is not null
    from public.teams t
    join public.coaches c on c.id = t.head_coach_id
    order by t.club_name, t.name;
end;
$$;

-- Active players of a team (for the preview and the prefilled template).
create function public.admin_team_players(p_team_id uuid)
returns setof public.players
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select * from public.players p
    where p.team_id = p_team_id and p.archived_at is null
    order by p.shirt_number nulls last, p.last_name;
end;
$$;

-- Imports players into a team: a row with the shirt number of an active player
-- updates that player, any other row adds a new player. Nobody is removed.
-- p_players: [{ first_name, last_name, shirt_number, primary_position,
--   secondary_positions[], preferred_foot, birth_year, joined_club_year,
--   status, expected_return_date, notes }]
create function public.admin_import_players(p_team_id uuid, p_players jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_number smallint;
  v_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t where t.id = p_team_id and t.archived_at is null) then
    raise exception 'team not found or archived' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) > 200 then
    raise exception 'players must be a list of at most 200' using errcode = 'check_violation';
  end if;

  for v_row in select * from jsonb_array_elements(p_players) loop
    v_number := nullif(v_row ->> 'shirt_number', '')::smallint;
    v_id := null;
    if v_number is not null then
      select p.id into v_id from public.players p
      where p.team_id = p_team_id and p.shirt_number = v_number and p.archived_at is null;
    end if;

    if v_id is not null then
      update public.players set
        first_name = v_row ->> 'first_name',
        last_name = v_row ->> 'last_name',
        primary_position = nullif(v_row ->> 'primary_position', ''),
        secondary_positions = coalesce(array(select jsonb_array_elements_text(v_row -> 'secondary_positions')), '{}'),
        preferred_foot = nullif(v_row ->> 'preferred_foot', '')::public.preferred_foot,
        birth_year = nullif(v_row ->> 'birth_year', '')::smallint,
        joined_club_year = nullif(v_row ->> 'joined_club_year', '')::smallint,
        status = coalesce(nullif(v_row ->> 'status', ''), 'available')::public.player_status,
        expected_return_date = nullif(v_row ->> 'expected_return_date', '')::date,
        notes = coalesce(nullif(v_row ->> 'notes', ''), notes)
      where id = v_id;
      v_updated := v_updated + 1;
    else
      insert into public.players (
        team_id, first_name, last_name, shirt_number, primary_position, secondary_positions,
        preferred_foot, birth_year, joined_club_year, status, expected_return_date, notes
      ) values (
        p_team_id,
        v_row ->> 'first_name',
        v_row ->> 'last_name',
        v_number,
        nullif(v_row ->> 'primary_position', ''),
        coalesce(array(select jsonb_array_elements_text(v_row -> 'secondary_positions')), '{}'),
        nullif(v_row ->> 'preferred_foot', '')::public.preferred_foot,
        nullif(v_row ->> 'birth_year', '')::smallint,
        nullif(v_row ->> 'joined_club_year', '')::smallint,
        coalesce(nullif(v_row ->> 'status', ''), 'available')::public.player_status,
        nullif(v_row ->> 'expected_return_date', '')::date,
        nullif(v_row ->> 'notes', '')
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

revoke execute on function public.is_platform_admin() from anon, public;
revoke execute on function public.admin_teams() from anon, public;
revoke execute on function public.admin_team_players(uuid) from anon, public;
revoke execute on function public.admin_import_players(uuid, jsonb) from anon, public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_teams() to authenticated;
grant execute on function public.admin_team_players(uuid) to authenticated;
grant execute on function public.admin_import_players(uuid, jsonb) to authenticated;
