-- =============================================================================
-- Oefenstof in de weekplanning: standard load of an exercise (sets, work and
-- rest per set, intensity, RPE) so the staff can scale it to the week type and
-- match day, and a switch to keep an exercise out of the staff's selection.
-- RLS is unchanged (own exercises only).
-- =============================================================================

alter table public.exercises
  add column sets smallint check (sets is null or sets between 1 and 20),
  add column work_min numeric(4, 1) check (work_min is null or (work_min > 0 and work_min <= 60)),
  add column rest_min numeric(4, 1) check (rest_min is null or (rest_min >= 0 and rest_min <= 30)),
  add column intensity text check (intensity is null or intensity in ('laag', 'matig', 'hoog', 'maximaal')),
  add column rpe smallint check (rpe is null or rpe between 1 and 10),
  add column use_in_planning boolean not null default true;
