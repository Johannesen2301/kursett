// KUNNSKAPSGRUNNLAG for AI-assistenten
//
// ⚠️ REGEL: Ingenting legges til her uten at det er verifisert mot Skatteetaten.
// Assistenten svarer KUN fra dette. Står det ikke her, skal den si at den ikke vet.
//
// Verifisert juli 2026 mot skatteetaten.no og lovforarbeidene.

export const SKATTEKUNNSKAP = `
# NORSK AKSJESKATT — VERIFISERT GRUNNLAG

## Satser (inntektsåret 2025)
- Skjermingsrente for personlige aksjonærer: 3,6 %
  Kilde: skatteetaten.no/satser/skjermingsrente-for-aksjer-og-enkeltpersonforetak/
  (Merk: 4,6 % gjelder ENKELTPERSONFORETAK, ikke aksjonærer. Ikke bland disse.)
- Alminnelig inntekt: 22 %
- Oppjusteringsfaktor for aksjeinntekt: 1,72
- Effektiv skattesats på utbytte og aksjegevinst: 37,84 % (22 % × 1,72)

## Skjermingsfradraget — hva det er
Et årlig fradrag som gjør at den delen av avkastningen som tilsvarer risikofri rente
ikke beskattes. Beregnes som: skjermingsgrunnlag × skjermingsrente.

## Skjermingsgrunnlag — VANLIG KONTO (VPS)
Formel: inngangsverdi (kostpris + kurtasje) + ubenyttet skjerming fra tidligere år

- Beregnes PER AKSJE, ikke samlet
- Tilfaller den som eier aksjen 31. desember i inntektsåret
- FIFU (først inn, først ut) gjelder ved salg

Eksempel: kostpris 10 000 kr + 100 kr kurtasje = grunnlag 10 100 kr.
Med 3,6 % skjermingsrente blir skjermingsfradraget 363,60 kr.

## Skjermingsgrunnlag — AKSJESPAREKONTO (ASK)
Formel: laveste innskuddssaldo i året + ubenyttet skjerming fra tidligere år
Hjemmel: skatteloven § 10-21 femte ledd femte punktum

- Beregnes SAMLET for hele kontoen, ikke per aksje
- FIFU er IKKE relevant på ASK
- Skatteetaten: "For verdipapirene som holdes på aksjesparekontoen er det dermed
  ikke nødvendig å beregne skjerming per aksje/andel, ei heller holde rede på FIFU."

VIKTIG: "Laveste innskuddssaldo" betyr laveste nivå på samlet INNSKUTT KAPITAL
gjennom året — ikke det minste enkeltinnskuddet, og ikke markedsverdien.
Det er UTTAK som senker grunnlaget. Sene innskudd skader ingenting.

Skatteetatens eksempel: Har du 500 kr innskutt, skyter inn til 1 000 kr i april,
og tar ut 300 kr i mai — blir skjermingsgrunnlaget 500 kr, fordi det var laveste
innskuddsbeløp i løpet av året.

## Ubenyttet skjerming — fremføres MED RENTER
Er skjermingen større enn utbyttet, forsvinner ikke resten. Den fremføres og
LEGGES TIL skjermingsgrunnlaget året etter. Det gir en rentes-rente-effekt.

Skatteetaten: "Ubenyttet skjerming legges til skjermingsgrunnlaget, og kan
fremføres til fradrag i senere års uttak og utbytter, jf. sktl. § 10-21 femte
ledd tredje punktum."

Eksempel: grunnlag 10 100 kr gir 363,60 kr skjerming. Tar du bare ut 50 kr i
utbytte, fremføres 313,60 kr. Nytt grunnlag neste år: 10 413,60 kr.

## Skjerming kan IKKE skape tap
Ved salg kan ubenyttet skjerming redusere gevinsten til null — men ikke skape
eller øke et fradragsberettiget tap. Selger du med tap, faller gjenværende
ubenyttet skjerming bort permanent.

Skatteetaten: "Det innrømmes ikke fradrag for ubenyttet skjerming med større
beløp enn at gevinsten settes til null. Ubenyttet skjerming kan ikke øke
fradragsberettiget tap."

Praktisk konsekvens: sitter du på mye oppspart skjerming på en aksje som ligger
under vann, går den tapt hvis du selger med tap.

## 31.12-regelen (gjelder VPS)
Hele årets skjerming tilfaller den som eier aksjen 31. desember. Ingen
forholdsmessig fordeling.
- Selger du i romjulen: gir bort et helt års skjerming til kjøperen
- Kjøper du før nyttår: får hele årets skjerming, selv etter få dagers eierskap

## ASK vs VPS — hovedforskjeller
| | ASK | VPS |
|---|---|---|
| Utbytte | Beskattes ikke løpende | Beskattes samme år |
| Gevinst | Beskattes ikke inne i kontoen | Beskattes ved salg |
| Skatt utløses | Ved uttak ut over innskutt kapital | Løpende |
| Skjerming beregnes | Samlet på kontoen | Per aksje |
| FIFU | Ikke relevant | Gjelder |

For en langsiktig investor som reinvesterer utbytte gir ASK som regel bedre
sammensatt vekst, siden ingenting beskattes løpende inne i kontoen.

## Flere ASK-kontoer
Det er lovlig å ha flere aksjesparekontoer, også hos ulike tilbydere.
Overføring av verdipapirer mellom egne ASK-kontoer utløser ikke beskatning.

## Endre skattemeldingen
Du kan selv endre skattemeldingen inntil tre år tilbake. Oppdager du feil i
skjermingsfradraget, kan du rette det og få igjen penger.

## Sjekkliste
1. Finn "ubenyttet skjerming" i fjorårets skattemelding — vet du hvor mye du har oppspart?
2. Skal du selge noe du har eid lenge med lite utbytte? Sjekk oppspart skjerming først.
3. Handler du rundt årsskiftet? Husk 31.12-regelen (VPS).
4. Utenlandske aksjer eller byttet megler? Dobbeltsjekk tallene.
`

export const OM_KURSETT = `
# OM KURSETT — praktisk hjelp

## Hva Kursett er
Et norsk verktøy for utbytteinvestorer. Gratis å bruke.
- Skjermingsfradrag-kalkulator (åpen, ingen innlogging): /skjermingsfradrag
- Skatteregler med kilder: /skatteregler
- Porteføljetracker med Nordnet-import (krever konto)
- Fellesskap: profiler, toppliste, venner, meldinger, rom med chat og forum

## Importere portefølje fra Nordnet
1. Logg inn i Nordnet
2. Gå til Depot / Beholdning
3. Last ned beholdningen som CSV
4. I Kursett: Min portefølje → Velg CSV-fil

Kursett leser aksjenavn, antall, markedsverdi og GAV fra filen.
Formatet er UTF-16, tab-separert — det håndteres automatisk.

## Personvern
- Sammensetningen din vises til andre KUN i prosent — aldri kronebeløp,
  aldri antall aksjer, aldri porteføljeverdi
- Du velger selv om andre kan se hvilke aksjer du eier (av som standard)
- Dette er håndhevet i databasen, ikke bare i grensesnittet
- Du kan slette kontoen din når som helst under Profil

## Opprette konto
E-post og passord. Du må bekrefte e-posten før du kommer inn.
For å delta sosialt (rom, venner, meldinger) må du velge et brukernavn under Profil.

## Rom og fellesskap
Alle kan opprette rom (maks 5 per bruker). Rom har både sanntidschat og forumtråder.
Rom er for diskusjon og analyse — betalte kjøps-/salgssignaler er ikke tillatt.
Du kan rapportere og blokkere brukere.
`
