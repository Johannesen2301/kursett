-- Kursett — Cache for Børs-screeneren
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Egen tabell fra kurs_cache (porteføljesidens cache): screeneren har andre felt
-- (dagsendring, 52-ukers høy/lav) og trenger ikke like fersk data som en brukers
-- egen portefølje — se CACHE_MINUTTER i edge-bors-cache.ts. Holder også
-- porteføljesiden 100 % uberørt av den nye, offentlige (innloggingsfrie) siden.

create table if not exists bors_cache (
  ticker text primary key,
  pris numeric,
  valuta text,
  dag_endring_pst numeric,
  femtito_uke_hoy numeric,
  femtito_uke_lav numeric,
  aarlig_utbytte numeric,
  direkteavkastning numeric,
  oppdatert timestamptz not null default now()
);

create index if not exists bors_cache_oppdatert_idx on bors_cache (oppdatert);

-- RLS på: ingen direkte tilgang fra klienten. Kun Edge-funksjonen
-- (service_role) leser/skriver. Klienten får dataene gjennom funksjonen.
alter table bors_cache enable row level security;

-- Ingen policies = ingen tilgang for anon/authenticated. Det er meningen.
-- service_role går forbi RLS automatisk.
