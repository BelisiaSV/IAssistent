-- =============================================================================
-- The head coach can remove versions of the week document or match
-- preparation he does not want to keep. A removed run stays in the database
-- (soft delete) so it keeps counting for the daily AI limit and versions are
-- never reused; the app hides it. The approved version and a version that is
-- still being made cannot be removed, and removing is final.
-- =============================================================================

alter table public.staff_runs add column deleted_at timestamptz;

grant update (deleted_at) on public.staff_runs to authenticated;

create function public.before_staff_run_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'a removed run cannot be restored' using errcode = 'check_violation';
  end if;
  if old.deleted_at is not null and new.status is distinct from old.status then
    raise exception 'a removed run cannot change' using errcode = 'check_violation';
  end if;
  if old.deleted_at is null and new.deleted_at is not null and old.status in ('approved', 'generating') then
    raise exception 'an approved or running run cannot be removed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.before_staff_run_update() from anon, public;

create trigger staff_runs_before_update
  before update on public.staff_runs
  for each row execute function public.before_staff_run_update();
