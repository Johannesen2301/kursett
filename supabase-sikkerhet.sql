-- Kursett — Sikkerhet: rate-limiting og moderering
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Beskytter mot spam og misbruk når appen er åpen for fremmede.

-- ---------- 1. Rate-limiting på meldinger ----------
-- Maks 20 DM-er per minutt, 30 rom-meldinger per minutt.
-- Hindrer at én person kan spamme tusen meldinger.

create or replace function sjekk_meldingsgrense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antall int;
begin
  select count(*) into antall
  from meldinger
  where avsender_id = auth.uid()
    and opprettet > now() - interval '1 minute';

  if antall >= 20 then
    raise exception 'For mange meldinger. Vent litt før du sender flere.';
  end if;
  return new;
end;
$$;

drop trigger if exists meldingsgrense on meldinger;
create trigger meldingsgrense before insert on meldinger
  for each row execute function sjekk_meldingsgrense();

create or replace function sjekk_rommeldingsgrense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antall int;
begin
  select count(*) into antall
  from rom_meldinger
  where avsender_id = auth.uid()
    and opprettet > now() - interval '1 minute';

  if antall >= 30 then
    raise exception 'For mange meldinger. Vent litt før du sender flere.';
  end if;
  return new;
end;
$$;

drop trigger if exists rommeldingsgrense on rom_meldinger;
create trigger rommeldingsgrense before insert on rom_meldinger
  for each row execute function sjekk_rommeldingsgrense();

-- ---------- 2. Grense på antall rom per bruker ----------
-- Maks 5 rom per person. Hindrer at noen fyller oppdag-siden med søppel.

create or replace function sjekk_romgrense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antall int;
begin
  select count(*) into antall from rom where eier_id = auth.uid();
  if antall >= 5 then
    raise exception 'Du kan ha maks 5 rom. Slett et rom før du oppretter et nytt.';
  end if;
  return new;
end;
$$;

drop trigger if exists romgrense on rom;
create trigger romgrense before insert on rom
  for each row execute function sjekk_romgrense();

-- ---------- 3. Grense på venneforespørsler ----------
-- Maks 30 utgående ventende forespørsler. Hindrer masseutsending.

create or replace function sjekk_foresporselsgrense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antall int;
begin
  select count(*) into antall
  from vennskap
  where avsender_id = auth.uid() and status = 'ventende';

  if antall >= 30 then
    raise exception 'Du har for mange ventende venneforespørsler.';
  end if;
  return new;
end;
$$;

drop trigger if exists foresporselsgrense on vennskap;
create trigger foresporselsgrense before insert on vennskap
  for each row execute function sjekk_foresporselsgrense();

-- ---------- 4. Lengdegrenser ----------
-- Hindrer at noen limer inn en roman eller sprenger databasen.

alter table meldinger drop constraint if exists meldinger_lengde;
alter table meldinger add constraint meldinger_lengde
  check (char_length(tekst) between 1 and 2000);

alter table rom_meldinger drop constraint if exists rom_meldinger_lengde;
alter table rom_meldinger add constraint rom_meldinger_lengde
  check (char_length(tekst) between 1 and 2000);

alter table forum_innlegg drop constraint if exists forum_innlegg_lengde;
alter table forum_innlegg add constraint forum_innlegg_lengde
  check (char_length(tekst) between 1 and 5000);

alter table profiler drop constraint if exists profiler_bio_lengde;
alter table profiler add constraint profiler_bio_lengde
  check (bio is null or char_length(bio) <= 300);

alter table rom drop constraint if exists rom_navn_lengde;
alter table rom add constraint rom_navn_lengde
  check (char_length(navn) between 2 and 60);

-- ---------- 5. Admin: din oversikt over rapporter ----------
-- Bytt ut e-posten under med din egen hvis den er annerledes.

create or replace function er_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'johannesjohannesen7@gmail.com'
  );
$$;
grant execute on function er_admin() to authenticated;

-- Admin kan lese alle rapporter
drop policy if exists "admin leser rapporter" on rapporter;
create policy "admin leser rapporter" on rapporter for select
  using (er_admin());

-- Admin kan slette hvilken som helst melding (moderering)
drop policy if exists "slett rom-meldinger" on rom_meldinger;
create policy "slett rom-meldinger" on rom_meldinger for delete
  using (
    auth.uid() = avsender_id
    or er_admin()
    or exists (
      select 1 from rom r
      where r.id = rom_meldinger.rom_id and r.eier_id = auth.uid()
    )
  );

-- Admin kan slette hvilket som helst rom
drop policy if exists "eier sletter rom" on rom;
create policy "eier sletter rom" on rom for delete
  using (auth.uid() = eier_id or er_admin());

-- Oversikt for admin: rapporter med kontekst
create or replace function admin_rapporter()
returns table (
  id uuid, opprettet timestamptz, type text, begrunnelse text,
  innhold_tekst text, melder text, meldt text, status text
)
language sql security definer set search_path = public as $$
  select r.id, r.opprettet, r.type, r.begrunnelse, r.innhold_tekst,
         coalesce(pm.brukernavn, 'ukjent'),
         coalesce(pb.brukernavn, 'ukjent'),
         r.status
  from rapporter r
  left join profiler pm on pm.id = r.melder_id
  left join profiler pb on pb.id = r.meldt_bruker_id
  where er_admin()
  order by r.opprettet desc;
$$;
grant execute on function admin_rapporter() to authenticated;
