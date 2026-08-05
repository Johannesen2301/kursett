-- Kursett — Cache for kurshistorikk (aksje-detaljsiden)
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Egen, liten tabell fra bors_cache/kurs_cache: denne lagrer en hel tidsserie
-- (til grafen på /app/aksje/:ticker), ikke ett øyeblikksbilde, og hentes kun
-- én ticker av gangen (lav last — ingen bolke-strategi nødvendig som for
-- screeneren).

create table if not exists aksje_historikk_cache (
  ticker text primary key,
  serie jsonb,
  oppdatert timestamptz not null default now()
);

create index if not exists aksje_historikk_cache_oppdatert_idx on aksje_historikk_cache (oppdatert);

alter table aksje_historikk_cache enable row level security;
-- Ingen policies = ingen tilgang for anon/authenticated direkte. Kun Edge-funksjonen
-- (service_role) leser/skriver. Klienten får dataene gjennom funksjonen.
