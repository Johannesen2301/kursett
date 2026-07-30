-- Kursett — flere kontoer per bruker (VPS/ASK) uten at ny import sletter gamle.
-- Kjør i Supabase → SQL Editor → lim inn → Run.
--
-- «konto» brukes fra nå av som et FRITT KONTONAVN brukeren selv velger ved
-- import (f.eks. «VPS Nordnet», «ASK barn»), ikke lenger CSV-filnavnet.
-- «konto_type» er den faktiske klassifiseringen ('vps' | 'ask') som Min skatt
-- og skattemotoren bruker til å vite hvordan en posisjon skal behandles.
--
-- Eksisterende rader har konto_type = null. Appen tolker null som 'vps' for
-- bakoverkompatibilitet, siden alt som er importert før denne migreringen
-- alltid har blitt behandlet som VPS.

alter table posisjoner add column if not exists konto_type text;
