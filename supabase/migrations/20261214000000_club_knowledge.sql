-- =============================================================================
-- Knowledge and collaboration (club module "knowledge").
--
--   * club_documents: central documents and methodological guidelines of the
--     club (private bucket club-documents, path <club_id>/<document_id>/<file>).
--     Every member reads them; owner, admin and technical director add and
--     remove them.
--   * club_shared_trainings: a head coach shares a training day of his team's
--     approved week document with the club (a snapshot, no player names). The
--     technical director marks good ones as an example for an age category.
--   * club_training_comments: feedback between trainers on a shared training.
-- Everything only while the club has the module; nothing of other clubs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-documents',
  'club-documents',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp', 'text/plain'
  ]
)
on conflict (id) do nothing;

create table public.club_documents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  kind text not null default 'document' check (kind in ('guideline', 'agreement', 'document')),
  description text check (description is null or length(description) <= 600),
  age_categories text[] not null default '{}'
    check (age_categories <@ array['u15', 'u16', 'u17', 'u19', 'beloften', 'b-elftal', 'senioren']),
  file_path text not null unique check (length(file_path) <= 300),
  file_name text not null check (length(file_name) between 1 and 200),
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 20971520),
  uploaded_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = club_id::text)
);

create table public.club_shared_trainings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  session_date date not null,
  title text not null check (length(trim(title)) between 1 and 120),
  age_category text not null check (age_category in ('u15', 'u16', 'u17', 'u19', 'beloften', 'b-elftal', 'senioren')),
  -- The training day of the approved week document (Assistant Coach), without names
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  note text check (note is null or length(note) <= 600),
  is_example boolean not null default false,
  shared_by uuid default auth.uid() references public.coaches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, session_date)
);

create table public.club_training_comments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.club_shared_trainings (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  author_id uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index club_documents_club_idx on public.club_documents (club_id, created_at desc);
create index club_shared_trainings_club_idx on public.club_shared_trainings (club_id, created_at desc);
create index club_training_comments_training_idx on public.club_training_comments (training_id, created_at);

-- A shared training belongs to a team of that club; a comment to a training of that club.
create function public.before_club_knowledge_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'club_shared_trainings' then
    if not exists (select 1 from public.teams t where t.id = new.team_id and t.club_id = new.club_id) then
      raise exception 'team is not a team of this club' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'club_training_comments' then
    if not exists (select 1 from public.club_shared_trainings s where s.id = new.training_id and s.club_id = new.club_id) then
      raise exception 'training is not shared with this club' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger club_shared_trainings_before_insert before insert on public.club_shared_trainings
  for each row execute function public.before_club_knowledge_insert();
create trigger club_training_comments_before_insert before insert on public.club_training_comments
  for each row execute function public.before_club_knowledge_insert();

-- Only the example mark changes, and only by owner, admin or technical director.
create function public.before_club_shared_training_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'is_example') is distinct from (to_jsonb(old) - 'is_example') then
    raise exception 'a shared training does not change' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger club_shared_trainings_before_update before update on public.club_shared_trainings
  for each row execute function public.before_club_shared_training_update();

alter table public.club_documents enable row level security;
alter table public.club_shared_trainings enable row level security;
alter table public.club_training_comments enable row level security;
revoke all on public.club_documents, public.club_shared_trainings, public.club_training_comments
  from anon, authenticated, public;
grant select, insert, delete on public.club_documents, public.club_training_comments to authenticated;
grant select, insert, delete on public.club_shared_trainings to authenticated;
grant update (is_example) on public.club_shared_trainings to authenticated;

create policy "club_documents: members read" on public.club_documents
  for select to authenticated using (public.is_club_member(club_id) and public.club_has_module(club_id, 'knowledge'));
create policy "club_documents: managers add" on public.club_documents
  for insert to authenticated with check (
    public.has_club_role(club_id, '{owner,admin,technical_director}')
    and public.club_has_module(club_id, 'knowledge')
    and uploaded_by = (select auth.uid())
  );
create policy "club_documents: managers remove" on public.club_documents
  for delete to authenticated using (public.has_club_role(club_id, '{owner,admin,technical_director}'));

create policy "club_shared_trainings: members read" on public.club_shared_trainings
  for select to authenticated using (public.is_club_member(club_id) and public.club_has_module(club_id, 'knowledge'));
create policy "club_shared_trainings: head coach shares" on public.club_shared_trainings
  for insert to authenticated with check (
    public.can_write_team(team_id)
    and public.is_club_member(club_id)
    and public.club_has_module(club_id, 'knowledge')
    and shared_by = (select auth.uid())
  );
create policy "club_shared_trainings: managers mark examples" on public.club_shared_trainings
  for update to authenticated
  using (public.has_club_role(club_id, '{owner,admin,technical_director}'))
  with check (public.has_club_role(club_id, '{owner,admin,technical_director}'));
create policy "club_shared_trainings: author or managers remove" on public.club_shared_trainings
  for delete to authenticated using (
    shared_by = (select auth.uid()) or public.has_club_role(club_id, '{owner,admin,technical_director}')
  );

create policy "club_training_comments: members read" on public.club_training_comments
  for select to authenticated using (public.is_club_member(club_id) and public.club_has_module(club_id, 'knowledge'));
create policy "club_training_comments: members write" on public.club_training_comments
  for insert to authenticated with check (
    public.is_club_member(club_id)
    and public.club_has_module(club_id, 'knowledge')
    and author_id = (select auth.uid())
  );
create policy "club_training_comments: author or managers remove" on public.club_training_comments
  for delete to authenticated using (
    author_id = (select auth.uid()) or public.has_club_role(club_id, '{owner,admin,technical_director}')
  );

-- Files of the club documents: members read, owner/admin/TD upload and remove.
create policy "club-documents: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'club-documents'
    and public.is_club_member(public.team_id_from_storage_path(name))
    and public.club_has_module(public.team_id_from_storage_path(name), 'knowledge')
  );
create policy "club-documents: upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'club-documents'
    and public.has_club_role(public.team_id_from_storage_path(name), '{owner,admin,technical_director}')
    and public.club_has_module(public.team_id_from_storage_path(name), 'knowledge')
  );
create policy "club-documents: delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'club-documents'
    and public.has_club_role(public.team_id_from_storage_path(name), '{owner,admin,technical_director}')
  );

-- Names of the club's members (no e-mail), for the authors of shared trainings and feedback.
create function public.club_member_names(p_club_id uuid)
returns table (coach_id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_club_member(p_club_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select distinct c.id, nullif(trim(c.full_name), '')
    from public.club_members m
    join public.coaches c on c.id = m.coach_id
    where m.club_id = p_club_id;
end;
$$;

revoke execute on function public.club_member_names(uuid) from anon, public;
grant execute on function public.club_member_names(uuid) to authenticated;
revoke execute on function public.before_club_knowledge_insert() from anon, authenticated, public;
revoke execute on function public.before_club_shared_training_update() from anon, authenticated, public;
