-- Dashboard: the formation of the team on the big pitch (a code from
-- staff/_gedeeld/formaties.json, checked by the app; null = the first one).

alter table public.teams
  add column default_formation text check (default_formation is null or length(default_formation) between 1 and 20);
