-- 1. The admin can correct a bank exercise in the app. The last imported
--    version is kept (source_title, source_content): a later import overwrites
--    the exercise only when the exercise changed in the source as well.
-- 2. The head coach can rewrite the principle of the week for the match
--    presentation without asking the Tactical Coach again.

alter table public.bank_exercises
  add column source_title text,
  add column source_content jsonb check (source_content is null or jsonb_typeof(source_content) = 'object');

update public.bank_exercises set source_title = title, source_content = content;

create or replace function public.admin_import_bank_exercises(p_exercises jsonb)
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
        (number, source_id, title, kind, phase, target_group, tags, principles, content, media_kind, media_key, media_path,
         source_title, source_content)
      values (
        v_item->>'number', v_item->>'source_id', v_item->>'title', v_item->>'kind', v_item->>'phase',
        v_item->>'target_group', v_tags, v_principles, v_item->'content', v_item->>'media_kind', v_item->>'media_key',
        (select b.media_path from public.bank_exercises b
          where b.media_key = v_item->>'media_key' and b.media_path is not null limit 1),
        v_item->>'title', v_item->'content'
      );
      v_added := v_added + 1;
    -- Compared with the last import, not with the exercise: corrections made
    -- in the app stay until the exercise changes in the source.
    elsif coalesce(v_existing.source_content, v_existing.content) is distinct from v_item->'content'
      or coalesce(v_existing.source_title, v_existing.title) is distinct from v_item->>'title'
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
        media_path = case when v_existing.media_key is distinct from v_item->>'media_key' then null else v_existing.media_path end,
        source_title = v_item->>'title',
        source_content = v_item->'content',
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

-- A correction by the admin: a new version, the status and the file stay.
create function public.admin_update_bank_exercise(
  p_id uuid,
  p_title text,
  p_kind text,
  p_phase text,
  p_target_group text,
  p_tags text[],
  p_principles text[],
  p_content jsonb
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
  update public.bank_exercises set
    title = p_title,
    kind = p_kind,
    phase = p_phase,
    target_group = p_target_group,
    tags = p_tags,
    principles = p_principles,
    content = p_content,
    version = version + 1
  where id = p_id;
  if not found then
    raise exception 'exercise not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.admin_update_bank_exercise(uuid, text, text, text, text, text[], text[], jsonb) from anon, public;
grant execute on function public.admin_update_bank_exercise(uuid, text, text, text, text, text[], text[], jsonb) to authenticated;

-- { titel, uitleg } chosen by the head coach; null = the principle of the Tactical Coach.
alter table public.week_plans
  add column principle_override jsonb check (
    principle_override is null
    or (jsonb_typeof(principle_override) = 'object'
        and jsonb_typeof(principle_override->'titel') = 'string'
        and jsonb_typeof(principle_override->'uitleg') = 'string')
  );
