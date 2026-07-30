-- Kursett — Slett konto (GDPR)
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Brukeren har rett til å bli slettet. Denne funksjonen fjerner alle data
-- knyttet til kontoen. De fleste tabellene har allerede «on delete cascade»
-- mot auth.users, men vi sletter eksplisitt for å være sikre — og for at
-- brukeren skal kunne gjøre det selv fra appen.

create or replace function slett_min_konto()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  meg uuid := auth.uid();
begin
  if meg is null then
    raise exception 'Ikke innlogget';
  end if;

  -- Porteføljedata
  delete from posisjoner where bruker_id = meg;

  -- Sosialt
  delete from folger where folger_id = meg or fulgt_id = meg;
  delete from vennskap where avsender_id = meg or mottaker_id = meg;
  delete from meldinger where avsender_id = meg or mottaker_id = meg;
  delete from blokkeringer where blokkerer_id = meg or blokkert_id = meg;

  -- Rom: meldinger og medlemskap. Rom man EIER slettes også (med innhold).
  delete from rom_meldinger where avsender_id = meg;
  delete from rom_medlemmer where bruker_id = meg;
  delete from forum_innlegg where avsender_id = meg;
  delete from forum_traader where avsender_id = meg;
  delete from rom where eier_id = meg;

  -- Rapporter man selv har sendt
  delete from rapporter where melder_id = meg;

  -- Profil
  delete from profiler where id = meg;

  -- Selve brukerkontoen (auth.users) — cascade rydder resten
  delete from auth.users where id = meg;
end;
$$;

grant execute on function slett_min_konto() to authenticated;
