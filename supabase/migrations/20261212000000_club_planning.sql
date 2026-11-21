-- =============================================================================
-- Club planning (club module "planning").
--
-- The overview of all teams (week, month, season: planned and done trainings,
-- match-day structure, approved week documents) is built in the app on the
-- existing week plans, staff runs and session loads; each team shows only for
-- who may read it (can_read_team).
-- New here: club periods with training goals, per age category. Owner, admin
-- and technical director make them; every member of the club reads them. The
-- staff of a club team gets the current period of its age category.
-- =============================================================================

create table public.club_periods (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  -- Empty = every age category of the club.
  age_categories text[] not null default '{}'
    check (age_categories <@ array['u15', 'u16', 'u17', 'u19', 'beloften', 'b-elftal', 'senioren']),
  -- Training goals of the period, in order.
  goals text[] not null default '{}' check (cardinality(goals) <= 10),
  focus text check (focus is null or length(focus) <= 600),
  created_by uuid references public.coaches (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 400)
);

create index club_periods_club_idx on public.club_periods (club_id, starts_on);

alter table public.club_periods enable row level security;
revoke all on public.club_periods from anon, authenticated, public;
grant select on public.club_periods to authenticated;

create policy "club_periods: members read" on public.club_periods
  for select to authenticated using (public.is_club_member(club_id) or public.is_platform_admin());

-- Create (p_id null) or change a period.
--   p_data = { title, starts_on, ends_on, age_categories, goals, focus }
create function public.save_club_period(p_club_id uuid, p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_goals text[] := coalesce((
    select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p_data->'goals', '[]')) x where trim(x) <> ''
  ), '{}');
  v_categories text[] := coalesce((
    select array_agg(distinct x) from jsonb_array_elements_text(coalesce(p_data->'age_categories', '[]')) x
  ), '{}');
begin
  if not public.has_club_role(p_club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_has_module(p_club_id, 'planning') then
    raise exception 'module not active' using errcode = 'check_violation', hint = 'module_inactive';
  end if;
  if exists (select 1 from unnest(v_goals) g where length(g) > 200) then
    raise exception 'goal too long' using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into public.club_periods (club_id, title, starts_on, ends_on, age_categories, goals, focus)
    values (
      p_club_id, trim(p_data->>'title'), (p_data->>'starts_on')::date, (p_data->>'ends_on')::date,
      v_categories, v_goals, nullif(trim(p_data->>'focus'), '')
    )
    returning id into v_id;
  else
    update public.club_periods set
      title = trim(p_data->>'title'),
      starts_on = (p_data->>'starts_on')::date,
      ends_on = (p_data->>'ends_on')::date,
      age_categories = v_categories,
      goals = v_goals,
      focus = nullif(trim(p_data->>'focus'), ''),
      updated_at = now()
    where id = p_id and club_id = p_club_id
    returning id into v_id;
    if v_id is null then
      raise exception 'period not found' using errcode = 'P0002';
    end if;
  end if;
  perform public.club_audit(p_club_id, 'period.saved', null, null,
    jsonb_build_object('period_id', v_id, 'title', trim(p_data->>'title')));
  return v_id;
end;
$$;

create function public.delete_club_period(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.club_periods;
begin
  select * into v_row from public.club_periods where id = p_id;
  if not found or not public.has_club_role(v_row.club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.club_periods where id = p_id;
  perform public.club_audit(v_row.club_id, 'period.deleted', null, null,
    jsonb_build_object('period_id', p_id, 'title', v_row.title));
end;
$$;

revoke execute on function public.save_club_period(uuid, uuid, jsonb) from anon, public;
revoke execute on function public.delete_club_period(uuid) from anon, public;
grant execute on function public.save_club_period(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_club_period(uuid) to authenticated;
