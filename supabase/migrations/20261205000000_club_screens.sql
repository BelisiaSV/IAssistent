-- =============================================================================
-- Club environment, part 3: what the club's own screens need.
--
--   * club_people(): the people of a club with their roles and licence, for
--     the club's owner, admin, technical director and team coordinator.
--   * club_pending_links(): pending requests to link a personal team, with the
--     team and requester names (the club cannot read a personal team itself).
--   * club_seats_used() only answers for a member of the club or the platform
--     admin.
-- =============================================================================

create function public.club_people(p_club_id uuid)
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
  if not (public.has_club_role(p_club_id, '{owner,admin,technical_director,team_coordinator}') or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
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

create function public.club_pending_links(p_club_id uuid)
returns table (id uuid, team_name text, team_club_name text, requester text, requested_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_club_role(p_club_id, '{owner,admin}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select l.id, t.name, t.club_name, coalesce(c.full_name, c.email), l.requested_at
    from public.club_team_links l
    join public.teams t on t.id = l.team_id
    join public.coaches c on c.id = l.requested_by
    where l.club_id = p_club_id and l.status = 'pending'
    order by l.requested_at;
end;
$$;

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
  )::integer end;
$$;

revoke execute on function public.club_people(uuid), public.club_pending_links(uuid) from anon, public;
grant execute on function public.club_people(uuid), public.club_pending_links(uuid) to authenticated;
