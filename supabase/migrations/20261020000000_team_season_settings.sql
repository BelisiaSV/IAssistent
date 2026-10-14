-- =============================================================================
-- Team settings: the preparation gets its own start date and cycle, next to
-- the competition (competition_start_date + periodization_weeks).
-- =============================================================================

alter table public.teams
  add column preparation_start_date date,
  add column preparation_weeks smallint not null default 4
    check (preparation_weeks in (4, 6, 8)),
  add constraint teams_preparation_before_competition
    check (preparation_start_date is null or competition_start_date is null
           or preparation_start_date < competition_start_date);
