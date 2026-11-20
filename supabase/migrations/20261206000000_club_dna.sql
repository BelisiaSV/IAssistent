-- =============================================================================
-- Club DNA: the football identity of a club (module "dna").
--
--   * One row per version. At most one draft and one published version per
--     club; an older published version becomes archived (history stays).
--   * The questionnaire is content (staff/_gedeeld/clubdna.json); the row
--     holds the answers: { versie, samenvatting, antwoorden, niveaus,
--     leeftijdsdoelen } (checked by the app with the staff engine).
--   * Every member reads the published version (the AI staff of a club team
--     gets it as context). Owner, admin and technical director also read the
--     draft and the history.
--   * The owner, admin and technical director edit the draft; the owner and the
--     technical director publish it (approval). Only while the club has the
--     module.
-- =============================================================================

create table public.club_dna (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  note text check (note is null or length(note) <= 300),
  created_by uuid references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.coaches (id) on delete set null,
  updated_at timestamptz not null default now(),
  published_by uuid references public.coaches (id) on delete set null,
  published_at timestamptz,
  unique (club_id, version)
);

create unique index club_dna_one_draft on public.club_dna (club_id) where status = 'draft';
create unique index club_dna_one_published on public.club_dna (club_id) where status = 'published';

alter table public.club_dna enable row level security;
revoke all on public.club_dna from anon, authenticated, public;
grant select on public.club_dna to authenticated;

create policy "club_dna: members read the published version, editors everything" on public.club_dna
  for select to authenticated using (
    (status = 'published' and public.is_club_member(club_id))
    or public.has_club_role(club_id, '{owner,admin,technical_director}')
  );

-- Save the draft (a new draft when there is none).
create function public.save_club_dna_draft(p_club_id uuid, p_content jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_club_role(p_club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_has_module(p_club_id, 'dna') then
    raise exception 'module not active' using errcode = 'check_violation', hint = 'module_inactive';
  end if;
  update public.club_dna
    set content = p_content, updated_by = (select auth.uid()), updated_at = now()
    where club_id = p_club_id and status = 'draft'
    returning id into v_id;
  if v_id is null then
    insert into public.club_dna (club_id, version, content, created_by, updated_by)
    values (
      p_club_id,
      coalesce((select max(version) from public.club_dna where club_id = p_club_id), 0) + 1,
      p_content, (select auth.uid()), (select auth.uid())
    )
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Publish the draft: it becomes the club's DNA; the previous one is archived.
create function public.publish_club_dna(p_club_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.club_dna;
begin
  if not public.has_club_role(p_club_id, '{owner,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.club_has_module(p_club_id, 'dna') then
    raise exception 'module not active' using errcode = 'check_violation', hint = 'module_inactive';
  end if;
  select * into v_draft from public.club_dna where club_id = p_club_id and status = 'draft' for update;
  if not found then
    raise exception 'no draft' using errcode = 'check_violation', hint = 'no_draft';
  end if;
  update public.club_dna set status = 'archived' where club_id = p_club_id and status = 'published';
  update public.club_dna
    set status = 'published', note = nullif(trim(p_note), ''),
        published_by = (select auth.uid()), published_at = now()
    where id = v_draft.id;
  perform public.club_audit(p_club_id, 'dna.published', null, null,
    jsonb_build_object('version', v_draft.version));
end;
$$;

-- Throw the draft away.
create function public.discard_club_dna_draft(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_club_role(p_club_id, '{owner,admin,technical_director}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.club_dna where club_id = p_club_id and status = 'draft';
end;
$$;

revoke execute on function
  public.save_club_dna_draft(uuid, jsonb),
  public.publish_club_dna(uuid, text),
  public.discard_club_dna_draft(uuid)
  from anon, public;
grant execute on function
  public.save_club_dna_draft(uuid, jsonb),
  public.publish_club_dna(uuid, text),
  public.discard_club_dna_draft(uuid)
  to authenticated;
