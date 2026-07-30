-- Kursett — Cache for kursdata
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Hvorfor: uten cache spør Edge-funksjonen Yahoo Finance på nytt for HVER bruker,
-- HVER sidelasting. Femti brukere med Equinor = femti kall for samme tall.
-- Yahoo er en uoffisiell kilde og kan blokkere oss. Med cache: ett kall per
-- ticker per 15. minutt, uansett hvor mange brukere.

create table if not exists kurs_cache (
  ticker text primary key,
  pris numeric,
  valuta text,
  aarlig_utbytte numeric,
  direkteavkastning numeric,
  utbytter jsonb,
  oppdatert timestamptz not null default now()
);

-- Rask oppslag på hva som er ferskt nok
create index if not exists kurs_cache_oppdatert_idx on kurs_cache (oppdatert);

-- RLS på: ingen direkte tilgang fra klienten i det hele tatt.
-- Kun Edge-funksjonen (som bruker service_role) skal lese/skrive her.
-- Klienten får kursene gjennom funksjonen, aldri direkte fra tabellen.
alter table kurs_cache enable row level security;

-- Ingen policies = ingen tilgang for anon/authenticated. Det er meningen.
-- service_role går forbi RLS automatisk.
