-- Age category of a team (youth teams U15–U19, the reserves and the first team).
-- Codes only; the app shows the labels.

alter table public.teams
  add column age_category text not null default 'senioren'
    check (age_category in ('u15', 'u16', 'u17', 'u19', 'beloften', 'b-elftal', 'senioren'));
