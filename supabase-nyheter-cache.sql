-- Kursett — Cache for aksje-nyheter
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Samme mønster som bors_cache/kurs_cache: én rad per ticker, med de siste
-- hentede artiklene lagret som jsonb. TTL på 30 min styres i edge-funksjonen
-- (nyheter endrer seg sjeldnere enn kurs, men oftere enn en gang i timen).

create table if not exists nyheter_cache (
  ticker text primary key,
  artikler jsonb,
  oppdatert timestamptz not null default now()
);

create index if not exists nyheter_cache_oppdatert_idx on nyheter_cache (oppdatert);

alter table nyheter_cache enable row level security;
-- Ingen policies = ingen tilgang for anon/authenticated direkte. Kun Edge-funksjonen
-- (service_role) leser/skriver. Klienten får dataene gjennom funksjonen.
