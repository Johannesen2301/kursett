-- Kursett — Skattemotor: lagret ubenyttet skjerming per aksje
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Posisjoner slettes og settes inn på nytt ved hver import (se Portefolje.jsx),
-- så posisjon-id er ikke stabilt over tid. Vi nøkler derfor på isin (eller
-- navn hvis isin mangler i CSV-en), ikke på posisjoner.id.

create table if not exists skjerming (
  bruker_id uuid not null references auth.users(id) on delete cascade,
  noekkel text not null,
  navn text,
  ubenyttet numeric not null default 0,
  aar integer not null,
  oppdatert timestamptz default now(),
  primary key (bruker_id, noekkel)
);

alter table skjerming enable row level security;

drop policy if exists "egen skjerming" on skjerming;
create policy "egen skjerming" on skjerming
  for all
  using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);
