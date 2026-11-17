-- Drawings and videos of the exercise bank. The admin uploads the files (named
-- after the code in the bank, media_key) to the private bucket bank-media; a
-- coach reads the file of an approved exercise through a signed URL.

alter table public.bank_exercises
  add column media_path text check (media_path is null or length(media_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-media',
  'bank-media',
  false,
  26214400, -- 25 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "bank-media: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'bank-media'
    and (
      public.is_platform_admin()
      or exists (select 1 from public.bank_exercises b where b.media_path = name and b.status = 'approved')
    )
  );
create policy "bank-media: admin uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'bank-media' and public.is_platform_admin());
create policy "bank-media: admin replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'bank-media' and public.is_platform_admin())
  with check (bucket_id = 'bank-media' and public.is_platform_admin());
create policy "bank-media: admin deletes" on storage.objects
  for delete to authenticated using (bucket_id = 'bank-media' and public.is_platform_admin());

-- Links an uploaded file to the exercises with that code. Returns how many.
create function public.admin_set_bank_media(p_media_key text, p_path text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  update public.bank_exercises set media_path = p_path where media_key = p_media_key;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.admin_set_bank_media(text, text) from anon, public;
grant execute on function public.admin_set_bank_media(text, text) to authenticated;

-- An import that changes the code of the drawing or video drops the old file link.
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
        (number, source_id, title, kind, phase, target_group, tags, principles, content, media_kind, media_key, media_path)
      values (
        v_item->>'number', v_item->>'source_id', v_item->>'title', v_item->>'kind', v_item->>'phase',
        v_item->>'target_group', v_tags, v_principles, v_item->'content', v_item->>'media_kind', v_item->>'media_key',
        -- A file already uploaded for this code (e.g. by another exercise).
        (select b.media_path from public.bank_exercises b
          where b.media_key = v_item->>'media_key' and b.media_path is not null limit 1)
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
        media_path = case when v_existing.media_key is distinct from v_item->>'media_key' then null else v_existing.media_path end,
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
