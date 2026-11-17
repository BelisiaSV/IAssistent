-- The exercise bank of the platform: exercises kept by the platform admin
-- (imported from the admin's own exercise database as JSON) that every coach
-- can use. Each exercise starts as 'review' (to be checked); coaches and the
-- staff only see the 'approved' ones. Next to the personal library of a coach
-- (public.exercises).

create table public.bank_exercises (
  id uuid primary key default gen_random_uuid(),
  -- Number in the bank, e.g. OEF-007: the key for later imports
  number text not null unique check (number ~ '^[A-Za-z]{1,10}-[0-9]{1,6}$'),
  -- Id in the source file
  source_id text check (source_id is null or length(source_id) <= 80),
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null check (length(trim(kind)) between 1 and 60),
  phase text check (phase is null or length(phase) <= 60),
  target_group text check (target_group is null or length(target_group) <= 200),
  tags text[] not null default '{}' check (cardinality(tags) <= 50),
  principles text[] not null default '{}' check (cardinality(principles) <= 50),
  -- The exercise as in the bank (organisation, progression, coaching points, …)
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  -- Drawing or video in the source (the file itself is added later)
  media_kind text check (media_kind is null or media_kind in ('image', 'video')),
  media_key text check (media_key is null or length(media_key) <= 120),
  status text not null default 'review' check (status in ('review', 'approved')),
  version integer not null default 1 check (version >= 1),
  imported_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_exercises_status_idx on public.bank_exercises (status, kind);

create trigger bank_exercises_set_updated_at before update on public.bank_exercises
  for each row execute function public.set_updated_at();

alter table public.bank_exercises enable row level security;
revoke all on public.bank_exercises from anon, authenticated, public;
grant select on public.bank_exercises to authenticated;

-- Coaches read the approved exercises; the admin reads everything. Writes only
-- through the admin functions below.
create policy "bank_exercises: read" on public.bank_exercises
  for select to authenticated using (status = 'approved' or public.is_platform_admin());

-- Imports exercises: the same number updates the exercise (a new version when
-- the content changed, the status stays), a new number adds one ('review').
-- Nothing is deleted. Returns { added, updated, unchanged }.
create function public.admin_import_bank_exercises(p_exercises jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_existing public.bank_exercises%rowtype;
  v_added integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_tags text[];
  v_principles text[];
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) > 500 then
    raise exception 'expected an array of at most 500 exercises' using errcode = 'check_violation';
  end if;

  for v_item in select value from jsonb_array_elements(p_exercises) loop
    v_tags := array(select jsonb_array_elements_text(coalesce(v_item->'tags', '[]'::jsonb)));
    v_principles := array(select jsonb_array_elements_text(coalesce(v_item->'principles', '[]'::jsonb)));
    select * into v_existing from public.bank_exercises where number = v_item->>'number' for update;
    if not found then
      insert into public.bank_exercises
        (number, source_id, title, kind, phase, target_group, tags, principles, content, media_kind, media_key)
      values (
        v_item->>'number', v_item->>'source_id', v_item->>'title', v_item->>'kind', v_item->>'phase',
        v_item->>'target_group', v_tags, v_principles, v_item->'content', v_item->>'media_kind', v_item->>'media_key'
      );
      v_added := v_added + 1;
    elsif v_existing.content is distinct from v_item->'content'
      or v_existing.title is distinct from v_item->>'title'
      or v_existing.media_key is distinct from v_item->>'media_key' then
      update public.bank_exercises set
        source_id = v_item->>'source_id',
        title = v_item->>'title',
        kind = v_item->>'kind',
        phase = v_item->>'phase',
        target_group = v_item->>'target_group',
        tags = v_tags,
        principles = v_principles,
        content = v_item->'content',
        media_kind = v_item->>'media_kind',
        media_key = v_item->>'media_key',
        version = v_existing.version + 1,
        imported_by = auth.uid()
      where id = v_existing.id;
      v_updated := v_updated + 1;
    else
      v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'unchanged', v_unchanged);
end;
$$;

-- Approves an exercise, or puts it back to review.
create function public.admin_set_bank_exercise_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  if p_status not in ('review', 'approved') then
    raise exception 'invalid status' using errcode = 'check_violation';
  end if;
  update public.bank_exercises set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.admin_import_bank_exercises(jsonb) from anon, public;
revoke execute on function public.admin_set_bank_exercise_status(uuid, text) from anon, public;
grant execute on function public.admin_import_bank_exercises(jsonb) to authenticated;
grant execute on function public.admin_set_bank_exercise_status(uuid, text) to authenticated;
