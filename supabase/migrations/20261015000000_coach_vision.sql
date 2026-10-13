-- =============================================================================
-- Fase 2a: visieprofiel van de coach
-- coach_profiles.vision = { "versie": "<versie vragenlijst>", "antwoorden": { "<thema>.<vraag>": ... } }
-- De vragen zelf staan in /staff/_gedeeld/visieprofiel.json; de app valideert de antwoorden.
-- =============================================================================

alter table public.coach_profiles
  add constraint coach_profiles_vision_summary_length
    check (vision_summary is null or length(vision_summary) <= 2000),
  add constraint coach_profiles_vision_is_object
    check (jsonb_typeof(vision) = 'object'),
  add constraint coach_profiles_vision_size
    check (pg_column_size(vision) <= 200000);
