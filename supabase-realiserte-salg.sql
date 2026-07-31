-- Kursett — Realiserte salg: en logg over faktiske aksjesalg i året, slik at
-- Min skatt kan vise en løpende sum av realisert gevinst/tap, ikke bare en
-- hypotetisk "hvis du selger i dag"-projeksjon.
-- Kjør i Supabase → SQL Editor → lim inn → Run.

create table if not exists realiserte_salg (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id) on delete cascade,
  noekkel text not null,
  navn text not null,
  antall numeric not null,
  kostpris numeric not null,
  salgssum numeric not null,
  salgskurtasje numeric not null default 0,
  ubenyttet_skjerming numeric not null default 0,
  dato date not null,
  aar integer not null,
  opprettet timestamptz default now()
);

alter table realiserte_salg enable row level security;

drop policy if exists "egne realiserte salg" on realiserte_salg;
create policy "egne realiserte salg" on realiserte_salg
  for all
  using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);
