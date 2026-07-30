-- Kursett — Lag 2c (del 2): forumtråder + krav om brukernavn for å delta
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- ---------- Innstramming: må ha profil for å delta i rom ----------
-- Man kan kun bli medlem / skrive i rom hvis man har opprettet en profil.
drop policy if exists "bli medlem" on rom_medlemmer;
create policy "bli medlem" on rom_medlemmer for insert with check (
  auth.uid() = bruker_id
  and exists (select 1 from profiler p where p.id = auth.uid())
);

drop policy if exists "skriv rom-meldinger" on rom_meldinger;
create policy "skriv rom-meldinger" on rom_meldinger for insert with check (
  auth.uid() = avsender_id
  and exists (select 1 from profiler p where p.id = auth.uid())
  and exists (select 1 from rom_medlemmer m where m.rom_id = rom_meldinger.rom_id and m.bruker_id = auth.uid())
);

-- ---------- Forumtråder ----------
create table if not exists forum_traader (
  id uuid primary key default gen_random_uuid(),
  rom_id uuid not null references rom(id) on delete cascade,
  tittel text not null,
  avsender_id uuid not null references auth.users(id) on delete cascade,
  opprettet timestamptz default now()
);
alter table forum_traader enable row level security;

-- Kun medlemmer av rommet ser tråder.
drop policy if exists "les traader" on forum_traader;
create policy "les traader" on forum_traader for select using (
  exists (select 1 from rom_medlemmer m where m.rom_id = forum_traader.rom_id and m.bruker_id = auth.uid())
);
-- Kun medlemmer med profil kan opprette tråder.
drop policy if exists "opprett traad" on forum_traader;
create policy "opprett traad" on forum_traader for insert with check (
  auth.uid() = avsender_id
  and exists (select 1 from profiler p where p.id = auth.uid())
  and exists (select 1 from rom_medlemmer m where m.rom_id = forum_traader.rom_id and m.bruker_id = auth.uid())
);

-- ---------- Foruminnlegg ----------
create table if not exists forum_innlegg (
  id uuid primary key default gen_random_uuid(),
  traad_id uuid not null references forum_traader(id) on delete cascade,
  avsender_id uuid not null references auth.users(id) on delete cascade,
  tekst text not null,
  opprettet timestamptz default now()
);
alter table forum_innlegg enable row level security;

drop policy if exists "les innlegg" on forum_innlegg;
create policy "les innlegg" on forum_innlegg for select using (
  exists (
    select 1 from forum_traader t
    join rom_medlemmer m on m.rom_id = t.rom_id
    where t.id = forum_innlegg.traad_id and m.bruker_id = auth.uid()
  )
);
drop policy if exists "skriv innlegg" on forum_innlegg;
create policy "skriv innlegg" on forum_innlegg for insert with check (
  auth.uid() = avsender_id
  and exists (select 1 from profiler p where p.id = auth.uid())
  and exists (
    select 1 from forum_traader t
    join rom_medlemmer m on m.rom_id = t.rom_id
    where t.id = forum_innlegg.traad_id and m.bruker_id = auth.uid()
  )
);

-- ---------- Funksjoner ----------
create or replace function rom_traader(rom uuid)
returns table (id uuid, tittel text, avsender_id uuid, brukernavn text, opprettet timestamptz, antall_svar bigint, siste timestamptz)
language sql security definer set search_path = public as $$
  select t.id, t.tittel, t.avsender_id, coalesce(pr.brukernavn, 'Ukjent'), t.opprettet,
         (select count(*) from forum_innlegg i where i.traad_id = t.id),
         coalesce((select max(i.opprettet) from forum_innlegg i where i.traad_id = t.id), t.opprettet)
  from forum_traader t
  left join profiler pr on pr.id = t.avsender_id
  where t.rom_id = rom
    and exists (select 1 from rom_medlemmer m where m.rom_id = rom and m.bruker_id = auth.uid())
  order by coalesce((select max(i.opprettet) from forum_innlegg i where i.traad_id = t.id), t.opprettet) desc;
$$;
grant execute on function rom_traader(uuid) to authenticated;

create or replace function traad_innlegg(traad uuid)
returns table (id uuid, avsender_id uuid, brukernavn text, avatar_farge text, tekst text, opprettet timestamptz)
language sql security definer set search_path = public as $$
  select i.id, i.avsender_id, coalesce(pr.brukernavn, 'Ukjent'), coalesce(pr.avatar_farge, '#8893A0'), i.tekst, i.opprettet
  from forum_innlegg i
  left join profiler pr on pr.id = i.avsender_id
  join forum_traader t on t.id = i.traad_id
  where i.traad_id = traad
    and exists (select 1 from rom_medlemmer m where m.rom_id = t.rom_id and m.bruker_id = auth.uid())
  order by i.opprettet asc;
$$;
grant execute on function traad_innlegg(uuid) to authenticated;
