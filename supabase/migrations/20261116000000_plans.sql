-- Price plans of the platform, managed by the platform admins, and the plan of
-- every account. Coaches read the active plans and their own plan; only admins
-- change plans or assign one to an account. Payment is not part of this (yet).

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) between 1 and 60),
  audience text not null check (audience in ('individual', 'club')),
  description text check (description is null or length(description) <= 300),
  -- null = price on request ("offerte op maat")
  price_cents integer check (price_cents is null or price_cents >= 0),
  billing_period text not null default 'year' check (billing_period in ('month', 'year')),
  -- optional yearly price for a monthly plan
  yearly_price_cents integer check (yearly_price_cents is null or yearly_price_cents >= 0),
  max_coaches integer check (max_coaches is null or max_coaches > 0),
  max_teams integer check (max_teams is null or max_teams > 0),
  features jsonb not null default '[]'::jsonb
    check (jsonb_typeof(features) = 'array' and jsonb_array_length(features) <= 20),
  recommended boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
revoke all on public.plans from anon, public;
grant select, insert, update, delete on public.plans to authenticated;

create policy "plans: everyone reads the active plans, admins all" on public.plans
  for select to authenticated using (active or public.is_platform_admin());
create policy "plans: admins insert" on public.plans
  for insert to authenticated with check (public.is_platform_admin());
create policy "plans: admins update" on public.plans
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "plans: admins delete" on public.plans
  for delete to authenticated using (public.is_platform_admin());

-- The plan of an account. Coaches may only update their full_name (column
-- grant in the foundation), so they cannot change their own plan.
alter table public.coaches
  add column plan_id uuid references public.plans (id) on delete set null;

-- Accounts with their plan, for the admins.
create function public.admin_accounts()
returns table (id uuid, email text, full_name text, plan_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  return query select c.id, c.email, c.full_name, c.plan_id from public.coaches c order by c.email;
end;
$$;

-- Assign a plan (or none) to an account.
create function public.admin_set_account_plan(p_coach uuid, p_plan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;
  update public.coaches set plan_id = p_plan where id = p_coach;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_accounts() from anon, public;
revoke execute on function public.admin_set_account_plan(uuid, uuid) from anon, public;
grant execute on function public.admin_accounts() to authenticated;
grant execute on function public.admin_set_account_plan(uuid, uuid) to authenticated;

-- Starting plans (the admins change them in the app).
insert into public.plans (code, name, audience, description, price_cents, billing_period, yearly_price_cents, max_coaches, max_teams, features, recommended, sort_order) values
  ('coach-pro', 'Coach Pro', 'individual', 'Voor één hoofdtrainer en één team.', 1995, 'month', 19900, 1, 1,
   '["Alle zeven AI-rollen in basisvorm", "Persoonlijke voetbalvisie", "Trainingsplanning", "Oefenstoffendatabank", "Basiswedstrijdvoorbereiding", "Beperkt AI-gebruiksbudget"]', false, 10),
  ('club-start', 'Club Start', 'club', 'Tot 3 hoofdtrainers.', 39900, 'year', null, 3, 3,
   '["Individuele accounts", "Maximaal 3 teams", "Gedeelde clubcontext", "Centrale oefenstoffendatabank", "Basisrapportering"]', true, 20),
  ('club-performance', 'Club Performance', 'club', 'Tot 6 hoofdtrainers.', 69900, 'year', null, 6, null,
   '["Alle basisfunctionaliteiten", "Uitgebreide AI Staff-samenwerking", "Meerdere teams", "Player Development", "Tactische presentaties", "Clubbeheerder"]', false, 30),
  ('club-academy', 'Club Academy', 'club', 'Tot 12 hoofdtrainers.', 119900, 'year', null, 12, null,
   '["Alles uit Performance", "Club DNA", "Jeugdopleidingsstructuur", "Overzicht over leeftijdscategorieën", "Centrale ontwikkelingsdoelstellingen", "Uitgebreide rapportering"]', false, 40),
  ('op-maat', 'Op maat', 'club', 'Voor grotere academies.', null, 'year', null, null, null,
   '["Meer dan 12 hoofdtrainers", "Offerte op maat"]', false, 50);
