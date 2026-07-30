-- Kursett — Slett egne meldinger
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- Man kan kun slette sine EGNE meldinger. Ikke andres.

-- ---------- Direktemeldinger ----------
drop policy if exists "slett egne meldinger" on meldinger;
create policy "slett egne meldinger" on meldinger for delete
  using (auth.uid() = avsender_id);

-- ---------- Rom-meldinger ----------
-- Avsender kan slette sin egen. Romeier kan også slette (moderering).
drop policy if exists "slett rom-meldinger" on rom_meldinger;
create policy "slett rom-meldinger" on rom_meldinger for delete
  using (
    auth.uid() = avsender_id
    or exists (
      select 1 from rom r
      where r.id = rom_meldinger.rom_id and r.eier_id = auth.uid()
    )
  );

-- ---------- Foruminnlegg ----------
drop policy if exists "slett egne innlegg" on forum_innlegg;
create policy "slett egne innlegg" on forum_innlegg for delete
  using (
    auth.uid() = avsender_id
    or exists (
      select 1 from forum_traader t
      join rom r on r.id = t.rom_id
      where t.id = forum_innlegg.traad_id and r.eier_id = auth.uid()
    )
  );

-- ---------- Forumtråder ----------
-- Sletter man tråden, slettes innleggene i den (cascade).
drop policy if exists "slett egne traader" on forum_traader;
create policy "slett egne traader" on forum_traader for delete
  using (
    auth.uid() = avsender_id
    or exists (
      select 1 from rom r
      where r.id = forum_traader.rom_id and r.eier_id = auth.uid()
    )
  );
