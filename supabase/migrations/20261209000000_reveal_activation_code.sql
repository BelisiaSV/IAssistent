-- =============================================================================
-- See an open activation code again ("eye" in the codes table).
--
-- The code itself (not only its hash) is kept in a separate table without any
-- grants or policies, as long as the code is open. Only those who may revoke a
-- code read it, through reveal_club_activation_code (logged in the club
-- history). Once a code is used or revoked, the stored code is removed.
-- Codes made before this migration have no stored code: use "Nieuwe code".
-- =============================================================================

create table public.club_activation_code_secrets (
  code_id uuid primary key references public.club_activation_codes (id) on delete cascade,
  code text not null
);
alter table public.club_activation_code_secrets enable row level security;
revoke all on public.club_activation_code_secrets from anon, authenticated, public;

-- Store the code when it is made.
create or replace function public.create_club_activation_code(
  p_club_id uuid,
  p_role public.club_role,
  p_expires_at timestamptz default null,
  p_team_id uuid default null,
  p_team_role text default null,
  p_note text default null
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_raw text := '';
  v_code text;
  v_seats integer;
  v_id uuid;
  i integer;
begin
  if not (
    public.is_platform_admin()
    or public.has_club_role(p_club_id, '{owner}')
    or (public.has_club_role(p_club_id, '{admin}') and p_role not in ('owner', 'admin'))
  ) then
    raise exception 'not allowed to create this code' using errcode = '42501';
  end if;
  if not public.club_is_active(p_club_id) then
    raise exception 'club is not active' using errcode = 'check_violation', hint = 'club_inactive';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = 'check_violation';
  end if;
  if p_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.club_id = p_club_id and t.archived_at is null
  ) then
    raise exception 'team is not an active team of the club' using errcode = 'check_violation';
  end if;
  if (p_team_role = 'coordinator' and p_role <> 'team_coordinator')
     or (p_team_role in ('head_coach', 'assistant_coach') and p_role not in ('coach', 'assistant_coach')) then
    raise exception 'team role does not fit the club role' using errcode = 'check_violation';
  end if;
  if public.club_role_uses_license(p_role) then
    select s.license_seats into v_seats
      from public.club_subscriptions s where s.club_id = p_club_id for update;
    if public.club_seats_used(p_club_id) >= coalesce(v_seats, 0) then
      raise exception 'no free licence seats'
        using errcode = 'check_violation', hint = 'license_seats_exhausted';
    end if;
  end if;

  -- 12 characters from a 32-character alphabet (60 random bits).
  v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  for i in 0..11 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);

  insert into public.club_activation_codes
    (club_id, code_hash, code_hint, role, team_id, team_role, note, expires_at, created_by)
  values
    (p_club_id, public.club_code_hash(v_raw), right(v_raw, 4), p_role, p_team_id, p_team_role,
     nullif(trim(p_note), ''), p_expires_at, (select auth.uid()))
  returning club_activation_codes.id into v_id;

  perform public.club_audit(p_club_id, 'code.created', null, p_team_id,
    jsonb_build_object('code_id', v_id, 'role', p_role, 'hint', right(v_raw, 4), 'team_role', p_team_role));
  insert into public.club_activation_code_secrets (code_id, code) values (v_id, v_code);
  return query select v_id, v_code;
end;
$$;

-- A used or revoked code is no longer kept.
create function public.forget_closed_activation_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'open' then
    delete from public.club_activation_code_secrets where code_id = new.id;
  end if;
  return new;
end;
$$;

create trigger after_club_activation_code_closed
  after update of status on public.club_activation_codes
  for each row when (new.status <> 'open')
  execute function public.forget_closed_activation_code();

-- The full code of an open code, for those who may revoke it. Null when the
-- code was made before codes were kept.
create function public.reveal_club_activation_code(p_code_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.club_activation_codes;
  v_secret text;
begin
  select * into v_code from public.club_activation_codes c where c.id = p_code_id;
  if not found or not (
    public.is_platform_admin()
    or public.has_club_role(v_code.club_id, '{owner}')
    or (public.has_club_role(v_code.club_id, '{admin}') and v_code.role not in ('owner', 'admin'))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_code.status <> 'open' then
    raise exception 'code is not open' using errcode = 'check_violation';
  end if;
  select s.code into v_secret from public.club_activation_code_secrets s where s.code_id = p_code_id;
  if v_secret is not null then
    perform public.club_audit(v_code.club_id, 'code.revealed', null, v_code.team_id,
      jsonb_build_object('code_id', p_code_id, 'hint', v_code.code_hint));
  end if;
  return v_secret;
end;
$$;

revoke execute on function public.forget_closed_activation_code() from anon, authenticated, public;
revoke execute on function public.reveal_club_activation_code(uuid) from anon, public;
grant execute on function public.reveal_club_activation_code(uuid) to authenticated;
