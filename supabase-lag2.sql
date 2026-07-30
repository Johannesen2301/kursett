-- Kursett — Lag 2a: profiler, følg-funksjon og offentlig sammensetning
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- ---------- Profiler ----------
create table if not exists profiler (
  id uuid primary key references auth.users(id) on delete cascade,
  brukernavn text unique not null,
  bio text,
  avatar_farge text default '#12868C',
  opprettet timestamptz default now()
);

alter table profiler enable row level security;

-- Profiler er offentlige (lesbare for alle innloggede). Kun eier kan endre sin egen.
drop policy if exists "les profiler" on profiler;
create policy "les profiler" on profiler for select using (true);

drop policy if exists "egen profil" on profiler;
create policy "egen profil" on profiler for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- Følg ----------
create table if not exists folger (
  folger_id uuid not null references auth.users(id) on delete cascade,
  fulgt_id  uuid not null references auth.users(id) on delete cascade,
  opprettet timestamptz default now(),
  primary key (folger_id, fulgt_id)
);

alter table folger enable row level security;

drop policy if exists "les folger" on folger;
create policy "les folger" on folger for select using (true);

-- Man kan kun opprette/slette EGNE følg-relasjoner.
drop policy if exists "egen folger" on folger;
create policy "egen folger" on folger for all
  using (auth.uid() = folger_id) with check (auth.uid() = folger_id);

-- ---------- Offentlig sammensetning (KUN prosent) ----------
-- security definer: går forbi RLS på posisjoner, men returnerer ALDRI kroner.
-- Kun for brukere som har opprettet en profil (opt-in til å være synlig).
create or replace function offentlig_sammensetning(bruker uuid)
returns table (sektor text, vekt numeric)
language sql
security definer
set search_path = public
as $$
  with total as (
    select coalesce(sum(markedsverdi), 0) as sum_verdi
    from posisjoner where bruker_id = bruker
  )
  select p.sektor,
         round((sum(p.markedsverdi) / nullif((select sum_verdi from total), 0) * 100)::numeric, 1) as vekt
  from posisjoner p
  where p.bruker_id = bruker
    and exists (select 1 from profiler pr where pr.id = bruker)
  group by p.sektor
  order by vekt desc nulls last;
$$;

grant execute on function offentlig_sammensetning(uuid) to authenticated, anon;

-- Offentlige beholdninger (navn + sektor + prosent). Aldri kroner/antall.
create or replace function offentlige_beholdninger(bruker uuid)
returns table (navn text, sektor text, vekt numeric)
language sql
security definer
set search_path = public
as $$
  with total as (
    select coalesce(sum(markedsverdi), 0) as sum_verdi
    from posisjoner where bruker_id = bruker
  )
  select p.navn, p.sektor,
         round((p.markedsverdi / nullif((select sum_verdi from total), 0) * 100)::numeric, 1) as vekt
  from posisjoner p
  where p.bruker_id = bruker
    and exists (select 1 from profiler pr where pr.id = bruker)
  order by vekt desc nulls last;
$$;

grant execute on function offentlige_beholdninger(uuid) to authenticated, anon;

-- ---------- Toppliste ----------
-- Profiler med antall følgere. (Rangering på avkastning kommer senere.)
create or replace function toppliste()
returns table (id uuid, brukernavn text, bio text, avatar_farge text, antall_folgere bigint)
language sql
security definer
set search_path = public
as $$
  select pr.id, pr.brukernavn, pr.bio, pr.avatar_farge,
         (select count(*) from folger f where f.fulgt_id = pr.id) as antall_folgere
  from profiler pr
  order by antall_folgere desc, pr.opprettet asc;
$$;

grant execute on function toppliste() to authenticated, anon;
