-- =============================================================================
-- A new code for an open activation code.
--
-- Only the hash of a code is stored, so a code cannot be shown again. When the
-- club lost it, the open code is replaced: the old one is revoked and a new one
-- with the same role, team, note and expiry is made (the seat it held goes to
-- the new code). Same rights as revoking.
-- =============================================================================

create function public.reissue_club_activation_code(p_code_id uuid)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_code public.club_activation_codes;
begin
  select * into v_code from public.club_activation_codes c where c.id = p_code_id for update;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Checks the rights and that the code is still open.
  perform public.revoke_club_activation_code(p_code_id);
  return query
    select n.id, n.code
    from public.create_club_activation_code(
      v_code.club_id,
      v_code.role,
      case when v_code.expires_at > now() then v_code.expires_at end,
      v_code.team_id,
      v_code.team_role,
      v_code.note
    ) n;
end;
$$;

revoke execute on function public.reissue_club_activation_code(uuid) from anon, public;
grant execute on function public.reissue_club_activation_code(uuid) to authenticated;
