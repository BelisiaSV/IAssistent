-- The admin replaces or removes the drawing or video of one bank exercise
-- (before or after approving it). The file is uploaded to bank-media first;
-- this links it to the exercise. A later import keeps it as long as the code
-- of the drawing (media_key) in the source does not change.

create function public.admin_set_bank_exercise_media(p_number text, p_path text, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  if (p_path is null) <> (p_kind is null) or (p_kind is not null and p_kind not in ('image', 'video')) then
    raise exception 'invalid media' using errcode = 'check_violation';
  end if;
  update public.bank_exercises
  set media_path = p_path,
      media_kind = coalesce(p_kind, media_kind),
      version = version + 1
  where number = p_number;
  if not found then
    raise exception 'exercise not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.admin_set_bank_exercise_media(text, text, text) from anon, public;
grant execute on function public.admin_set_bank_exercise_media(text, text, text) to authenticated;
