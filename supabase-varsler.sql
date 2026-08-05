-- Kursett — Varsler: uleste meldinger
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Vi lagrer når brukeren sist leste hver samtale. Alt som er nyere = ulest.

-- ---------- Lest-status ----------
create table if not exists lest_status (
  bruker_id uuid not null references auth.users(id) on delete cascade,
  type text not null,              -- 'dm' | 'rom'
  ref_id uuid not null,            -- venn-id (for dm) eller rom-id
  sist_lest timestamptz not null default now(),
  primary key (bruker_id, type, ref_id)
);
alter table lest_status enable row level security;

drop policy if exists "egen lest-status" on lest_status;
create policy "egen lest-status" on lest_status for all
  using (auth.uid() = bruker_id) with check (auth.uid() = bruker_id);

-- Marker en samtale som lest (kalles når man åpner den)
create or replace function marker_lest(p_type text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  insert into lest_status (bruker_id, type, ref_id, sist_lest)
  values (auth.uid(), p_type, p_ref, now())
  on conflict (bruker_id, type, ref_id)
  do update set sist_lest = now();
$$;
grant execute on function marker_lest(text, uuid) to authenticated;

-- ---------- Uleste DM-er, per venn ----------
create or replace function uleste_dm()
returns table (venn_id uuid, antall bigint)
language sql security definer set search_path = public stable as $$
  select m.avsender_id,
         count(*)
  from meldinger m
  left join lest_status l
    on l.bruker_id = auth.uid() and l.type = 'dm' and l.ref_id = m.avsender_id
  where m.mottaker_id = auth.uid()
    and (l.sist_lest is null or m.opprettet > l.sist_lest)
  group by m.avsender_id;
$$;
grant execute on function uleste_dm() to authenticated;

-- ---------- Uleste rom-meldinger, per rom ----------
create or replace function uleste_rom()
returns table (rom_id uuid, antall bigint)
language sql security definer set search_path = public stable as $$
  select rm.rom_id, count(*)
  from rom_meldinger rm
  join rom_medlemmer mm on mm.rom_id = rm.rom_id and mm.bruker_id = auth.uid()
  left join lest_status l
    on l.bruker_id = auth.uid() and l.type = 'rom' and l.ref_id = rm.rom_id
  where rm.avsender_id <> auth.uid()
    and (l.sist_lest is null or rm.opprettet > l.sist_lest)
    and not er_blokkert(auth.uid(), rm.avsender_id)
  group by rm.rom_id;
$$;
grant execute on function uleste_rom() to authenticated;

-- ---------- Uleste @-nevnelser, per rom ----------
-- @nevnelser lagres ikke i egen kolonne — de er bare "@brukernavn" i selve
-- meldingsteksten. Dette gir et eget varsel (skilt fra generelt ulest-tall)
-- for meldinger som nevner deg spesifikt, siden forrige lesetidspunkt.
create or replace function uleste_nevnelser()
returns table (rom_id uuid, antall bigint)
language sql security definer set search_path = public stable as $$
  select rm.rom_id, count(*)
  from rom_meldinger rm
  join rom_medlemmer mm on mm.rom_id = rm.rom_id and mm.bruker_id = auth.uid()
  left join lest_status l
    on l.bruker_id = auth.uid() and l.type = 'rom' and l.ref_id = rm.rom_id
  join profiler meg on meg.id = auth.uid()
  where rm.avsender_id <> auth.uid()
    and (l.sist_lest is null or rm.opprettet > l.sist_lest)
    and not er_blokkert(auth.uid(), rm.avsender_id)
    and meg.brukernavn is not null
    and position(('@' || meg.brukernavn) in rm.tekst) > 0
  group by rm.rom_id;
$$;
grant execute on function uleste_nevnelser() to authenticated;

-- ---------- Samlet varseltelling (for sidebaren) ----------
-- Returtypen endres (ny kolonne), så funksjonen må droppes før den lages på nytt.
drop function if exists varsler();
create or replace function varsler()
returns table (dm bigint, rom bigint, foresporsler bigint, nevnelser bigint)
language sql security definer set search_path = public stable as $$
  select
    coalesce((select sum(antall) from uleste_dm()), 0),
    coalesce((select sum(antall) from uleste_rom()), 0),
    (select count(*) from vennskap v
      where v.mottaker_id = auth.uid() and v.status = 'ventende'),
    coalesce((select sum(antall) from uleste_nevnelser()), 0);
$$;
grant execute on function varsler() to authenticated;
