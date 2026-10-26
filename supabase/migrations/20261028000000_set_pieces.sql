-- =============================================================================
-- Stilstaande fases in de oefenstof: an exercise is either a training exercise
-- or a set piece. A set piece has a type (code from the Tactical Coach content),
-- an optional signal and roles with requirements; the staff fills in the
-- players every week. RLS is unchanged (own exercises only).
-- =============================================================================

alter table public.exercises
  add column kind text not null default 'exercise' check (kind in ('exercise', 'set_piece')),
  add column set_piece_type text check (set_piece_type is null or set_piece_type ~ '^[a-z][a-z_]{1,39}$'),
  add column signal text check (signal is null or length(signal) <= 80),
  -- [{ "rol": "...", "vereiste": "..." | null }]
  add column roles jsonb not null default '[]'::jsonb
    check (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) <= 15),
  add constraint exercises_set_piece_type check ((kind = 'set_piece') = (set_piece_type is not null));
