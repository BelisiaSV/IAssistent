-- =============================================================================
-- Shared exercise library of a club (module "exercises").
--
-- Three layers: the platform's exercise bank (bank_exercises, only the platform
-- admin changes it), the club's own exercises (club_exercises, below) and the
-- personal library of a coach (exercises).
--
--   * club_exercises: same shape as a bank exercise (title, kind, phase, target
--     group, tags, principles, content with the bank's Dutch keys), plus age
--     categories and level. Number CLUB-<n> per club. Origin: made by the club,
--     a variant of a bank exercise (base_bank_number) or shared by a coach from
--     his own library (source_exercise_id). Status proposed → approved
--     (or archived); approved exercises can be recommended.
--   * club_bank_picks: bank exercises the club marks as favourite, optionally
--     recommended.
--   * Every member reads the approved exercises and the picks; a coach also
--     his own proposals; owner, admin and technical director everything.
--   * Every member proposes; owner, admin and technical director approve,
--     archive, recommend and pick (their own exercises are approved at once).
-- =============================================================================

create table public.club_exercises (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  number text not null check (number ~ '^CLUB-[0-9]{1,6}$'),
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null check (length(trim(kind)) between 1 and 80),
  phase text check (phase is null or length(phase) <= 80),
  target_group text check (target_group is null or length(target_group) <= 120),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  principles text[] not null default '{}' check (cardinality(principles) <= 30),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 100000),
  age_categories text[] not null default '{}'
    check (age_categories <@ array['u15', 'u16', 'u17', 'u19', 'beloften', 'b-elftal', 'senioren']),
  level text check (level is null or length(level) <= 60),
  origin text not null default 'club' check (origin in ('club', 'bank_variant', 'coach_share')),
  base_bank_number text check (base_bank_number is null or base_bank_number ~ '^[A-Za-z]{1,10}-[0-9]{1,6}$'),
  source_exercise_id uuid references public.exercises (id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'archived')),
  recommended boolean not null default false,
  created_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references public.coaches (id) on delete set null,
  approved_at timestamptz,
  unique (club_id, number),
  constraint club_exercises_recommended check (not recommended or status = 'approved')
);

create index club_exercises_club_idx on public.club_exercises (club_id, status);

create table public.club_bank_picks (
  club_id uuid not null references public.clubs (id) on delete cascade,
  bank_number text not null references public.bank_exercises (number) on delete cascade on update cascade,
  recommended boolean not null default false,
  note text check (note is null or length(note) <= 300),
  picked_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (club_id, bank_number)
);

create trigger club_exercises_set_updated_at before update on public.club_exercises
  for each row execute function public.set_updated_at();

alter table public.club_exercises enable row level security;
alter table public.club_bank_picks enable row level security;
revoke all on public.club_exercises, public.club_bank_picks from anon, authenticated, public;
grant select on public.club_exercises, public.club_bank_picks to authenticated;

create policy "club_exercises: members read approved, authors their own, editors all" on public.club_exercises
  for select to authenticated using (
    (status = 'approved' and public.is_club_member(club_id))
    or (created_by = (select auth.uid()) and public.is_club_member(club_id))
    or public.has_club_role(club_id, '{owner,admin,technical_director}')
  );

create policy "club_bank_picks: members read" on public.club_bank_picks
  for select to authenticated using (public.is_club_member(club_id));

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Create (p_id null) or change a club exercise.
--   p_data = { title, kind, phase, target_group, tags, principles, content,
--              age_categories, level, origin, base_bank_number, source_exercise_id }
-- Every member may propose; owner, admin and technical director create approved
-- exercises and change every exercise; an author changes his own proposal.
create function public.save_club_exercise(p_club_id uuid, p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor boolean := public.has_club_role(p_club_id, '{owner,admin,technical_director}');
  v_row public.club_exercises;
  v_id uuid;
  v_source uuid := nullif(p_data->>'source_exercise_id', '')::uuid;
  v_text_array text[];
begin
  if not public.is_club_member(p_club_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_has_module(p_club_id, 'exercises') then
    raise exception 'module not active' using errcode = 'check_violation', hint = 'module_inactive';
  end if;
  if v_source is not null and not exists (
    select 1 from public.exercises e where e.id = v_source and e.coach_id = (select auth.uid())
  ) then
    raise exception 'only your own exercise can be shared' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.club_exercises (
      club_id, number, title, kind, phase, target_group, tags, principles, content,
      age_categories, level, origin, base_bank_number, source_exercise_id,
      status, created_by, approved_by, approved_at
    )
    values (
      p_club_id,
      'CLUB-' || (coalesce((
        select max(substring(number from 6)::integer) from public.club_exercises where club_id = p_club_id
      ), 0) + 1),
      trim(p_data->>'title'), trim(p_data->>'kind'), nullif(trim(p_data->>'phase'), ''),
      nullif(trim(p_data->>'target_group'), ''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'tags', '[]')) x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'principles', '[]')) x), '{}'),
      coalesce(p_data->'content', '{}'::jsonb),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'age_categories', '[]')) x), '{}'),
      nullif(trim(p_data->>'level'), ''),
      coalesce(nullif(p_data->>'origin', ''), 'club'),
      nullif(trim(p_data->>'base_bank_number'), ''),
      v_source,
      case when v_editor then 'approved' else 'proposed' end,
      (select auth.uid()),
      case when v_editor then (select auth.uid()) end,
      case when v_editor then now() end
    )
    returning id into v_id;
    perform public.club_audit(p_club_id, case when v_editor then 'exercise.created' else 'exercise.proposed' end,
      null, null, jsonb_build_object('exercise_id', v_id, 'title', trim(p_data->>'title')));
    return v_id;
  end if;

  select * into v_row from public.club_exercises where id = p_id and club_id = p_club_id for update;
  if not found or not (v_editor or (v_row.created_by = (select auth.uid()) and v_row.status = 'proposed')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.club_exercises set
    title = trim(p_data->>'title'),
    kind = trim(p_data->>'kind'),
    phase = nullif(trim(p_data->>'phase'), ''),
    target_group = nullif(trim(p_data->>'target_group'), ''),
    tags = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'tags', '[]')) x), '{}'),
    principles = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'principles', '[]')) x), '{}'),
    content = coalesce(p_data->'content', '{}'::jsonb),
    age_categories = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_data->'age_categories', '[]')) x), '{}'),
    level = nullif(trim(p_data->>'level'), '')
  where id = p_id;
  return p_id;
end;
$$;

-- Owner, admin or technical director: approve, archive or send back a club exercise.
create function public.set_club_exercise_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.club_exercises;
begin
  select * into v_row from public.club_exercises where id = p_id for update;
  if not found or not public.has_club_role(v_row.club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('proposed', 'approved', 'archived') then
    raise exception 'unknown status' using errcode = 'check_violation';
  end if;
  update public.club_exercises set
    status = p_status,
    recommended = recommended and p_status = 'approved',
    approved_by = case when p_status = 'approved' then (select auth.uid()) else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_id;
  perform public.club_audit(v_row.club_id, 'exercise.' || p_status, null, null,
    jsonb_build_object('exercise_id', p_id, 'title', v_row.title));
end;
$$;

-- Owner, admin or technical director: mark an approved club exercise as recommended (or not).
create function public.set_club_exercise_recommended(p_id uuid, p_recommended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.club_exercises;
begin
  select * into v_row from public.club_exercises where id = p_id for update;
  if not found or not public.has_club_role(v_row.club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_recommended and v_row.status <> 'approved' then
    raise exception 'only approved exercises are recommended' using errcode = 'check_violation';
  end if;
  update public.club_exercises set recommended = p_recommended where id = p_id;
end;
$$;

-- Owner, admin or technical director: pick a bank exercise as club favourite
-- (p_pick), optionally recommended; p_pick false removes it.
create function public.set_club_bank_pick(p_club_id uuid, p_bank_number text, p_pick boolean, p_recommended boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_club_role(p_club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_has_module(p_club_id, 'exercises') then
    raise exception 'module not active' using errcode = 'check_violation', hint = 'module_inactive';
  end if;
  if not p_pick then
    delete from public.club_bank_picks where club_id = p_club_id and bank_number = p_bank_number;
    return;
  end if;
  if not exists (select 1 from public.bank_exercises where number = p_bank_number and status = 'approved') then
    raise exception 'unknown bank exercise' using errcode = 'check_violation';
  end if;
  insert into public.club_bank_picks (club_id, bank_number, recommended, picked_by)
  values (p_club_id, p_bank_number, coalesce(p_recommended, false), (select auth.uid()))
  on conflict (club_id, bank_number) do update set recommended = excluded.recommended;
end;
$$;

revoke execute on function
  public.save_club_exercise(uuid, uuid, jsonb),
  public.set_club_exercise_status(uuid, text),
  public.set_club_exercise_recommended(uuid, boolean),
  public.set_club_bank_pick(uuid, text, boolean, boolean)
  from anon, public;
grant execute on function
  public.save_club_exercise(uuid, uuid, jsonb),
  public.set_club_exercise_status(uuid, text),
  public.set_club_exercise_recommended(uuid, boolean),
  public.set_club_bank_pick(uuid, text, boolean, boolean)
  to authenticated;
