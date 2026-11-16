-- Media for the match presentation of the Video Analyst: a logo per opponent
-- (uploaded by the head coach) and a cover photo and team photo per team.
-- Stored in the private bucket team-media, path <team_id>/<file>, shown with
-- signed URLs; the same access rules as the team logo.

alter table public.opponents
  add column logo_path text check (logo_path is null or length(logo_path) <= 300);

alter table public.teams
  add column cover_photo_path text check (cover_photo_path is null or length(cover_photo_path) <= 300),
  add column team_photo_path text check (team_photo_path is null or length(team_photo_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-media',
  'team-media',
  false,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "team-media: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'team-media'
    and public.can_read_team(public.team_id_from_storage_path(name))
  );
create policy "team-media: upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'team-media'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
create policy "team-media: replace" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'team-media'
    and public.can_write_team(public.team_id_from_storage_path(name))
  )
  with check (
    bucket_id = 'team-media'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
create policy "team-media: delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'team-media'
    and public.can_write_team(public.team_id_from_storage_path(name))
  );
