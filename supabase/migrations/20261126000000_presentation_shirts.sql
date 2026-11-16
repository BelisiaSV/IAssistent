-- The lineup slides of the match presentation show shirts: the opponent gets
-- shirt colours (set by the head coach on the presentation page). The cover
-- photo and team photo of a team are no longer shown on the slides.

alter table public.opponents
  add column shirt_color text check (shirt_color is null or shirt_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column shirt_trim_color text check (shirt_trim_color is null or shirt_trim_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.teams
  drop column if exists cover_photo_path,
  drop column if exists team_photo_path;
