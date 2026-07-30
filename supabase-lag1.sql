-- Kursett — Lag 1: porteføljetabell
-- Kjør denne i Supabase: prosjektet ditt → SQL Editor → lim inn → Run.

create table if not exists posisjoner (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id) on delete cascade,
  navn text not null,
  isin text,
  ticker text,
  sektor text,
  antall numeric,
  markedsverdi numeric,
  gav numeric,
  konto text,
  importert_at timestamptz default now()
);

-- Row Level Security: hver bruker ser og endrer KUN sine egne posisjoner.
alter table posisjoner enable row level security;

drop policy if exists "egne posisjoner" on posisjoner;
create policy "egne posisjoner" on posisjoner
  for all
  using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);
