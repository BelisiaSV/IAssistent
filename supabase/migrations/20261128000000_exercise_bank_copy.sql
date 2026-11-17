-- A coach can take over an exercise of the exercise bank into his own library
-- and change it there; the bank keeps its version. bank_number remembers where
-- the exercise came from (once per coach), so the bank shows "in your library".

alter table public.exercises
  add column bank_number text check (bank_number is null or length(bank_number) <= 20);

create unique index exercises_coach_bank_number_idx on public.exercises (coach_id, bank_number)
  where bank_number is not null;
