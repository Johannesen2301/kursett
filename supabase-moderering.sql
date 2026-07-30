-- Kursett — Blokkering og rapportering
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- ---------- Blokkering ----------
create table if not exists blokkeringer (
  blokkerer_id uuid not null references auth.users(id) on delete cascade,
  blokkert_id  uuid not null references auth.users(id) on delete cascade,
  opprettet timestamptz default now(),
  primary key (blokkerer_id, blokkert_id)
);
alter table blokkeringer enable row level security;

-- Man ser og styrer kun sine egne blokkeringer.
drop policy if exists "egne blokkeringer" on blokkeringer;
create policy "egne blokkeringer" on blokkeringer for all
  using (auth.uid() = blokkerer_id) with check (auth.uid() = blokkerer_id);

-- Hjelpefunksjon: er det en blokkering mellom to brukere (begge retninger)?
create or replace function er_blokkert(a uuid, b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from blokkeringer
    where (blokkerer_id = a and blokkert_id = b)
       or (blokkerer_id = b and blokkert_id = a)
  );
$$;
grant execute on function er_blokkert(uuid, uuid) to authenticated;

-- ---------- Rapportering ----------
create table if not exists rapporter (
  id uuid primary key default gen_random_uuid(),
  melder_id uuid not null references auth.users(id) on delete cascade,
  meldt_bruker_id uuid references auth.users(id) on delete set null,
  type text not null,                 -- 'dm' | 'rom' | 'forum' | 'profil'
  innhold_id uuid,                    -- id på meldingen/innlegget
  innhold_tekst text,                 -- kopi, så den finnes selv om originalen slettes
  begrunnelse text,
  status text not null default 'ny',  -- 'ny' | 'behandlet'
  opprettet timestamptz default now()
);
alter table rapporter enable row level security;

-- Man kan opprette rapporter, og se sine egne.
drop policy if exists "opprett rapport" on rapporter;
create policy "opprett rapport" on rapporter for insert
  with check (auth.uid() = melder_id);

drop policy if exists "les egne rapporter" on rapporter;
create policy "les egne rapporter" on rapporter for select
  using (auth.uid() = melder_id);

-- ---------- Håndhev blokkering på DM ----------
-- Man kan ikke sende melding til noen man har blokkert, eller som har blokkert deg.
drop policy if exists "send til venner" on meldinger;
create policy "send til venner" on meldinger for insert
  with check (
    auth.uid() = avsender_id
    and not er_blokkert(auth.uid(), meldinger.mottaker_id)
    and exists (
      select 1 from vennskap v
      where v.status = 'godtatt'
        and ((v.avsender_id = auth.uid() and v.mottaker_id = meldinger.mottaker_id)
          or (v.mottaker_id = auth.uid() and v.avsender_id = meldinger.mottaker_id))
    )
  );

-- ---------- Håndhev blokkering på venneforespørsler ----------
drop policy if exists "send foresporsel" on vennskap;
create policy "send foresporsel" on vennskap for insert
  with check (
    auth.uid() = avsender_id
    and not er_blokkert(auth.uid(), vennskap.mottaker_id)
  );

-- ---------- Skjul blokkerte i rom-chat ----------
-- Meldinger fra blokkerte brukere returneres ikke.
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
    and not er_blokkert(auth.uid(), m.avsender_id)
  order by m.opprettet asc;
$$;
grant execute on function rom_meldinger_med_navn(uuid) to authenticated;

-- ---------- Liste over hvem jeg har blokkert ----------
create or replace function mine_blokkeringer()
returns table (bruker_id uuid, brukernavn text, avatar_farge text)
language sql security definer set search_path = public as $$
  select b.blokkert_id, coalesce(pr.brukernavn, 'Ukjent'), coalesce(pr.avatar_farge, '#8893A0')
  from blokkeringer b
  left join profiler pr on pr.id = b.blokkert_id
  where b.blokkerer_id = auth.uid()
  order by pr.brukernavn;
$$;
grant execute on function mine_blokkeringer() to authenticated;
