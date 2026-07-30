-- Kursett — Lag 2c: rom + gruppechat
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- ---------- Rom ----------
create table if not exists rom (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  beskrivelse text,
  eier_id uuid not null references auth.users(id) on delete cascade,
  opprettet timestamptz default now()
);
alter table rom enable row level security;

-- Alle innloggede kan se rom (for å oppdage dem).
drop policy if exists "les rom" on rom;
create policy "les rom" on rom for select using (true);
-- Man kan opprette rom (som eier), og eier kan endre/slette sitt eget.
drop policy if exists "opprett rom" on rom;
create policy "opprett rom" on rom for insert with check (auth.uid() = eier_id);
drop policy if exists "eier endrer rom" on rom;
create policy "eier endrer rom" on rom for update using (auth.uid() = eier_id) with check (auth.uid() = eier_id);
drop policy if exists "eier sletter rom" on rom;
create policy "eier sletter rom" on rom for delete using (auth.uid() = eier_id);

-- ---------- Medlemskap ----------
create table if not exists rom_medlemmer (
  rom_id uuid not null references rom(id) on delete cascade,
  bruker_id uuid not null references auth.users(id) on delete cascade,
  opprettet timestamptz default now(),
  primary key (rom_id, bruker_id)
);
alter table rom_medlemmer enable row level security;

drop policy if exists "les medlemmer" on rom_medlemmer;
create policy "les medlemmer" on rom_medlemmer for select using (true);
-- Man melder seg inn/ut selv.
drop policy if exists "bli medlem" on rom_medlemmer;
create policy "bli medlem" on rom_medlemmer for insert with check (auth.uid() = bruker_id);
drop policy if exists "forlat rom" on rom_medlemmer;
create policy "forlat rom" on rom_medlemmer for delete using (auth.uid() = bruker_id);

-- ---------- Meldinger i rom ----------
create table if not exists rom_meldinger (
  id uuid primary key default gen_random_uuid(),
  rom_id uuid not null references rom(id) on delete cascade,
  avsender_id uuid not null references auth.users(id) on delete cascade,
  tekst text not null,
  opprettet timestamptz default now()
);
alter table rom_meldinger enable row level security;

-- Man kan KUN lese/skrive i rom man er medlem av.
drop policy if exists "les rom-meldinger" on rom_meldinger;
create policy "les rom-meldinger" on rom_meldinger for select using (
  exists (select 1 from rom_medlemmer m where m.rom_id = rom_meldinger.rom_id and m.bruker_id = auth.uid())
);
drop policy if exists "skriv rom-meldinger" on rom_meldinger;
create policy "skriv rom-meldinger" on rom_meldinger for insert with check (
  auth.uid() = avsender_id
  and exists (select 1 from rom_medlemmer m where m.rom_id = rom_meldinger.rom_id and m.bruker_id = auth.uid())
);

-- ---------- Funksjoner ----------
-- Alle rom, med medlemstall og om jeg er medlem.
create or replace function oppdag_rom()
returns table (id uuid, navn text, beskrivelse text, eier_id uuid, antall_medlemmer bigint, er_medlem boolean)
language sql security definer set search_path = public as $$
  select r.id, r.navn, r.beskrivelse, r.eier_id,
         (select count(*) from rom_medlemmer m where m.rom_id = r.id),
         exists (select 1 from rom_medlemmer m where m.rom_id = r.id and m.bruker_id = auth.uid())
  from rom r
  order by (select count(*) from rom_medlemmer m where m.rom_id = r.id) desc, r.opprettet desc;
$$;
grant execute on function oppdag_rom() to authenticated;

-- Meldinger i et rom, med avsenders profilnavn.
create or replace function rom_meldinger_med_navn(rom uuid)
returns table (id uuid, avsender_id uuid, brukernavn text, avatar_farge text, tekst text, opprettet timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.avsender_id,
         coalesce(pr.brukernavn, 'Ukjent'), coalesce(pr.avatar_farge, '#8893A0'),
         m.tekst, m.opprettet
  from rom_meldinger m
  left join profiler pr on pr.id = m.avsender_id
  where m.rom_id = rom
    and exists (select 1 from rom_medlemmer mm where mm.rom_id = rom and mm.bruker_id = auth.uid())
  order by m.opprettet asc;
$$;
grant execute on function rom_meldinger_med_navn(uuid) to authenticated;

-- Medlemmer i et rom, med profil (for å vise navn på sanntidsmeldinger).
create or replace function rom_medlemmer_med_navn(rom uuid)
returns table (bruker_id uuid, brukernavn text, avatar_farge text)
language sql security definer set search_path = public as $$
  select m.bruker_id, coalesce(pr.brukernavn, 'Ukjent'), coalesce(pr.avatar_farge, '#8893A0')
  from rom_medlemmer m
  left join profiler pr on pr.id = m.bruker_id
  where m.rom_id = rom
    and exists (select 1 from rom_medlemmer mm where mm.rom_id = rom and mm.bruker_id = auth.uid());
$$;
grant execute on function rom_medlemmer_med_navn(uuid) to authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table rom_meldinger;
