-- =============================================================================
-- Fix: creating a team or club failed with
--   "new row violates row-level security policy".
--
-- `insert ... returning` (used by the app to get the new id) also checks the
-- SELECT policy on the new row. The old policies looked the row up again via
-- security definer helpers (can_read_team / can_see_club), whose query cannot
-- see a row inserted by the same statement. The policies now check the row's
-- own columns first, so the head coach / creator can read it back immediately.
-- =============================================================================

drop policy "teams: read" on public.teams;
create policy "teams: read" on public.teams
  for select to authenticated using (
    head_coach_id = (select auth.uid())
    or public.has_assistant_access(id)
    or (club_id is not null and public.is_club_owner(club_id))
  );

drop policy "clubs: read" on public.clubs;
create policy "clubs: read" on public.clubs
  for select to authenticated using (
    created_by = (select auth.uid())
    or public.can_see_club(id)
  );

-- Users who signed up before the foundation migration ran have no coach row
-- (the trigger did not exist yet). Backfill them.
insert into public.coaches (id, email, full_name)
select u.id, u.email, nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
from auth.users u
where u.email is not null
  and not exists (select 1 from public.coaches c where c.id = u.id);

insert into public.coach_profiles (coach_id)
select c.id from public.coaches c
where not exists (select 1 from public.coach_profiles p where p.coach_id = c.id);
