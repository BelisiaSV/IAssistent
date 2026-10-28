-- Team dashboard: where the next match is played and who coaches the opponent.
-- teams.home_address: own ground (home matches); opponents.address: their ground
-- (away matches); opponents.coach_name: head coach of the opponent (never sent to the AI).

alter table public.teams
  add column home_address text check (home_address is null or length(home_address) <= 200);

alter table public.opponents
  add column address text check (address is null or length(address) <= 200),
  add column coach_name text check (coach_name is null or length(coach_name) <= 120);
