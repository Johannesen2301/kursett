// Beregning av skjermingsfradrag.
//
// KILDER (verifisert mot Skatteetaten):
// - Skjermingsgrunnlag VPS = inngangsverdi (kostpris + kurtasje) + ubenyttet skjerming
// - Skjermingsgrunnlag ASK = laveste innskuddssaldo i året + ubenyttet skjerming (sktl. § 10-21)
// - Skjermingsfradrag = skjermingsgrunnlag × skjermingsrente
// - Skjermingsrente 2025: 3,6 % (Skatteetaten)
// - Effektiv sats: 22 % × oppjusteringsfaktor 1,72 = 37,84 %
// - Ubenyttet skjerming fremføres og legges til grunnlaget året etter
// - Skjerming kan redusere gevinst til null, men ikke skape/øke tap
//
// ⚠️ Endre ALDRI tallene under uten å verifisere mot Skatteetaten først.

export const SKJERMINGSRENTE = {
  2025: 3.6,
  2024: 4.4,
  2023: 3.0,
}

export const OPPJUSTERINGSFAKTOR = 1.72
export const SATS_ALMINNELIG = 22
export const EFFEKTIV_SATS = 37.84 // 22 % × 1,72

export const SISTE_AAR = 2025

/**
 * Regner ut skjermingsfradrag for en aksje på vanlig konto (VPS).
 *
 * KREDITFRADRAG (kreditfradrag-parameteren, valgfri): fradrag i norsk skatt
 * for utenlandsk kildeskatt på utbytte, verifisert mot Skatteetaten (sktl.
 * §§ 16-20 til 16-27):
 * - Trekkes fra den BEREGNEDE NORSKE SKATTEN på utbyttet (etter skjerming og
 *   oppjustering) — ikke fra selve utbyttebeløpet, og ikke fra grunnlaget.
 * - Begrenset til norsk skatt på akkurat dette utbyttet — kan aldri gjøre
 *   skatten negativ.
 * - Beløpet brukeren oppgir skal allerede være begrenset til skatteavtalens
 *   sats (f.eks. 15 % for USA), ikke nødvendigvis alt som ble trukket —
 *   trekker megleren mer enn avtalesatsen (vanlig uten riktig skjema hos
 *   utenlandsk myndighet), må resten kreves tilbake der, ikke i Norge.
 * - Ubrukt kreditfradrag kan i realiteten fremføres i inntil 5 år (sktl.
 *   § 16-22) — IKKE støttet her ennå; overskytende vises bare informativt.
 */
export function beregnVPS({ kostpris, kurtasje = 0, ubenyttetSkjerming = 0, utbytte = 0, kreditfradrag = 0, aar = SISTE_AAR }) {
  const rente = SKJERMINGSRENTE[aar] ?? SKJERMINGSRENTE[SISTE_AAR]

  const inngangsverdi = (Number(kostpris) || 0) + (Number(kurtasje) || 0)
  const ubenyttet = Number(ubenyttetSkjerming) || 0
  const mottattUtbytte = Number(utbytte) || 0

  const grunnlag = inngangsverdi + ubenyttet
  const skjerming = grunnlag * (rente / 100)

  // Skjerming trekkes fra utbytte. Overskytende fremføres.
  const brukt = Math.min(skjerming, mottattUtbytte)
  const skattepliktig = Math.max(0, mottattUtbytte - skjerming)
  const nyUbenyttet = Math.max(0, skjerming - mottattUtbytte)

  // Skatt: skattepliktig beløp oppjusteres og beskattes
  const skattFoerKredit = skattepliktig * (EFFEKTIV_SATS / 100)
  const utenSkjerming = mottattUtbytte * (EFFEKTIV_SATS / 100)
  const spart = utenSkjerming - skattFoerKredit

  const kredit = Math.max(0, Number(kreditfradrag) || 0)
  const kreditfradragBrukt = Math.min(kredit, skattFoerKredit)
  const kreditfradragUbrukt = Math.max(0, kredit - skattFoerKredit)
  const skatt = skattFoerKredit - kreditfradragBrukt

  return {
    rente,
    inngangsverdi,
    ubenyttetInn: ubenyttet,
    grunnlag,
    skjerming,
    utbytte: mottattUtbytte,
    brukt,
    skattepliktig,
    skattFoerKredit,
    kreditfradragBrukt,
    kreditfradragUbrukt,
    skatt,
    utenSkjerming,
    spart,
    nyUbenyttet,
    nyttGrunnlag: grunnlag + nyUbenyttet,
  }
}

/**
 * Regner ut skjermingsfradrag for aksjesparekonto (ASK).
 * Merk: grunnlaget er LAVESTE innskuddssaldo gjennom året — ikke beholdning,
 * ikke siste innskudd. Uttak senker grunnlaget for hele året.
 */
export function beregnASK({ lavesteInnskudd, ubenyttetSkjerming = 0, uttak = 0, aar = SISTE_AAR }) {
  const rente = SKJERMINGSRENTE[aar] ?? SKJERMINGSRENTE[SISTE_AAR]

  const innskudd = Number(lavesteInnskudd) || 0
  const ubenyttet = Number(ubenyttetSkjerming) || 0
  const uttattBelop = Number(uttak) || 0

  const grunnlag = innskudd + ubenyttet
  const skjerming = grunnlag * (rente / 100)

  // På ASK beskattes ikke løpende — skatt utløses ved uttak ut over innskutt kapital
  const skattepliktig = Math.max(0, uttattBelop - skjerming)
  const skatt = skattepliktig * (EFFEKTIV_SATS / 100)
  const utenSkjerming = uttattBelop * (EFFEKTIV_SATS / 100)
  const spart = utenSkjerming - skatt
  const nyUbenyttet = Math.max(0, skjerming - uttattBelop)

  return {
    rente,
    innskudd,
    ubenyttetInn: ubenyttet,
    grunnlag,
    skjerming,
    uttak: uttattBelop,
    skattepliktig,
    skatt,
    utenSkjerming,
    spart,
    nyUbenyttet,
    nyttGrunnlag: grunnlag + nyUbenyttet,
  }
}

/**
 * Regner ut skjermingsfradrag for en FONDSANDEL (aksjefond, kombinasjonsfond
 * eller rentefond) på vanlig konto (VPS), avhengig av fondets aksjeandel.
 *
 * KILDE (verifisert direkte mot Skatteetatens side «Beskatning av andeler i
 * verdipapirfond», kryssjekket mot Skatteetatens rettledning for
 * tredjepartsopplysninger for Verdipapirfond og VFFs fondshåndbok):
 * - Aksjeandel ved inntektsårets begynnelse > 80 %: HELE avkastningen
 *   skattlegges som aksjeutbytte — samme som et rent aksjefond (beregnVPS).
 * - Aksjeandel < 20 %: HELE avkastningen skattlegges som renteinntekt —
 *   22 % flatt, ingen skjerming, ingen oppjusteringsfaktor.
 * - Aksjeandel 20–80 %: utbyttet splittes forholdsmessig i en aksjedel og en
 *   rentedel. Skjermingsgrunnlaget er fortsatt FULL kostpris + ubenyttet
 *   skjerming (ikke skalert ned), men skjermingen nettes KUN mot aksjedelen
 *   av utbyttet — rentedelen er alltid fullt skattepliktig med 22 %.
 *
 * En egen, nyere lovendring for verdipapirfond gjelder fra inntektsåret 2026
 * (fjerner skattelekkasje på FONDSNIVÅ), men endrer ikke denne andelshaver-
 * modellen for privatpersoner så vidt kildene over viser. ⚠️ Sjekk dette på
 * nytt mot Skatteetaten før denne funksjonen noensinne brukes for et
 * inntektsår senere enn 2025.
 *
 * Ved REALISASJON (salg) av fondsandeler skal aksjeandelen som brukes være
 * GJENNOMSNITTET av andelen i kjøpsåret og salgsåret — det er ikke
 * implementert her ennå, og fondsposisjoner ekskluderes derfor bevisst fra
 * salgsberegningen i Min skatt inntil det er på plass.
 */
export function beregnFondVPS({ kostpris, kurtasje = 0, ubenyttetSkjerming = 0, utbytte = 0, aksjeandel, aar = SISTE_AAR }) {
  const andel = Math.max(0, Math.min(100, Number(aksjeandel) || 0))
  const mottattUtbytte = Number(utbytte) || 0

  if (andel > 80) {
    return {
      ...beregnVPS({ kostpris, kurtasje, ubenyttetSkjerming, utbytte: mottattUtbytte, aar }),
      aksjeandel: andel, aksjedelUtbytte: mottattUtbytte, rentedelUtbytte: 0, rentedelSkatt: 0,
    }
  }

  const aksjedelUtbytte = andel < 20 ? 0 : mottattUtbytte * (andel / 100)
  const rentedelUtbytte = mottattUtbytte - aksjedelUtbytte
  const rentedelSkatt = rentedelUtbytte * (SATS_ALMINNELIG / 100)

  const a = beregnVPS({ kostpris, kurtasje, ubenyttetSkjerming, utbytte: aksjedelUtbytte, aar })

  return {
    ...a,
    aksjeandel: andel,
    utbytte: mottattUtbytte,
    aksjedelUtbytte,
    rentedelUtbytte,
    rentedelSkatt,
    skattepliktig: a.skattepliktig + rentedelUtbytte,
    skatt: a.skatt + rentedelSkatt,
    utenSkjerming: a.utenSkjerming + rentedelSkatt,
  }
}

/**
 * Regner ut gevinst/tap ved salg av aksjer på vanlig konto (VPS), med
 * skjermingsfradrag mot gevinsten.
 *
 * Viktig, og annerledes enn utbytte-tilfellet:
 * - Skjerming kan redusere en gevinst til null, men ALDRI skape eller øke et tap.
 *   Er det tap, brukes ingen skjerming i det hele tatt.
 * - Ubrukt skjerming ved salg fremføres IKKE til neste år — den bortfaller,
 *   siden posisjonen ikke lenger eies. Dette er forskjellig fra utbytte, der
 *   ubenyttet skjerming fremføres (sktl. § 10-12/10-31).
 */
export function beregnGevinstVedSalg({ kostpris, kurtasje = 0, salgssum, salgskurtasje = 0, ubenyttetSkjerming = 0, aar = SISTE_AAR }) {
  const rente = SKJERMINGSRENTE[aar] ?? SKJERMINGSRENTE[SISTE_AAR]

  const inngangsverdi = (Number(kostpris) || 0) + (Number(kurtasje) || 0)
  const nettoSalgssum = (Number(salgssum) || 0) - (Number(salgskurtasje) || 0)
  const ubenyttet = Number(ubenyttetSkjerming) || 0

  const grunnlag = inngangsverdi + ubenyttet
  const skjerming = grunnlag * (rente / 100)

  const gevinstFoerSkjerming = nettoSalgssum - inngangsverdi
  const erGevinst = gevinstFoerSkjerming > 0

  const brukt = erGevinst ? Math.min(skjerming, gevinstFoerSkjerming) : 0
  const skattepliktig = erGevinst ? Math.max(0, gevinstFoerSkjerming - skjerming) : 0
  const tap = erGevinst ? 0 : gevinstFoerSkjerming // negativt tall (eller 0)
  const bortfaltSkjerming = erGevinst ? Math.max(0, skjerming - gevinstFoerSkjerming) : skjerming

  const skatt = skattepliktig * (EFFEKTIV_SATS / 100)
  // Ved tap er "skatt" negativ — et fradrag, altså en skattebesparelse.
  const skattEffekt = erGevinst ? skatt : -Math.abs(tap) * (EFFEKTIV_SATS / 100)

  const utenSkjerming = Math.max(0, gevinstFoerSkjerming) * (EFFEKTIV_SATS / 100)
  const spart = utenSkjerming - skatt

  return {
    rente,
    inngangsverdi,
    ubenyttetInn: ubenyttet,
    grunnlag,
    skjerming,
    salgssum: nettoSalgssum,
    gevinstFoerSkjerming,
    erGevinst,
    brukt,
    skattepliktig,
    tap,
    skatt,
    skattEffekt,
    utenSkjerming,
    spart,
    bortfaltSkjerming,
  }
}

/**
 * Regner ut gevinst/tap ved salg av FONDSANDELER (kombinasjons-/rentefond),
 * med samme 20/80-terskelregel som beregnFondVPS (se kilde-kommentaren der).
 *
 * VIKTIG: Skatteetaten sier gevinsten skal splittes med GJENNOMSNITTET av
 * aksjeandelen i kjøpsåret og salgsåret — det gjennomsnittet må regnes ut
 * FØR denne funksjonen kalles, og sendes inn som `aksjeandel`.
 *
 * Skjermingsgrunnlaget er fortsatt full kostpris + ubenyttet skjerming (ikke
 * skalert), men skjerming kan bare redusere aksjedelen av gevinsten — akkurat
 * som ved utbytte i beregnFondVPS. Rentedelen beskattes/gir fradrag alltid
 * med 22 % flatt, uten skjerming og uten oppjusteringsfaktor. Ubrukt skjerming
 * ved salg fremføres IKKE (samme som beregnGevinstVedSalg for aksjer).
 */
export function beregnFondGevinstVedSalg({ kostpris, kurtasje = 0, salgssum, salgskurtasje = 0, ubenyttetSkjerming = 0, aksjeandel, aar = SISTE_AAR }) {
  const andel = Math.max(0, Math.min(100, Number(aksjeandel) || 0))

  if (andel > 80) {
    return {
      ...beregnGevinstVedSalg({ kostpris, kurtasje, salgssum, salgskurtasje, ubenyttetSkjerming, aar }),
      aksjeandel: andel, aksjedelGevinst: null, rentedelGevinst: 0, rentedelSkattEffekt: 0,
    }
  }

  const rente = SKJERMINGSRENTE[aar] ?? SKJERMINGSRENTE[SISTE_AAR]
  const inngangsverdi = (Number(kostpris) || 0) + (Number(kurtasje) || 0)
  const nettoSalgssum = (Number(salgssum) || 0) - (Number(salgskurtasje) || 0)
  const ubenyttet = Number(ubenyttetSkjerming) || 0

  const grunnlag = inngangsverdi + ubenyttet
  const skjerming = grunnlag * (rente / 100)

  const gevinstFoerSkjerming = nettoSalgssum - inngangsverdi
  const erGevinst = gevinstFoerSkjerming > 0

  // Aksjedel og rentedel har alltid samme fortegn som gevinstFoerSkjerming —
  // begge er bare en proporsjonal andel av samme tall.
  const aksjedelGevinst = andel < 20 ? 0 : gevinstFoerSkjerming * (andel / 100)
  const rentedelGevinst = gevinstFoerSkjerming - aksjedelGevinst
  const rentedelSkattEffekt = rentedelGevinst * (SATS_ALMINNELIG / 100)

  const brukt = erGevinst ? Math.min(skjerming, aksjedelGevinst) : 0
  const skattepliktigAksjedel = erGevinst ? Math.max(0, aksjedelGevinst - skjerming) : 0
  const bortfaltSkjerming = erGevinst ? Math.max(0, skjerming - aksjedelGevinst) : skjerming
  const skattAksjedel = skattepliktigAksjedel * (EFFEKTIV_SATS / 100)
  const skattEffektAksjedel = erGevinst ? skattAksjedel : -Math.abs(aksjedelGevinst) * (EFFEKTIV_SATS / 100)

  const skattepliktig = skattepliktigAksjedel + Math.max(0, rentedelGevinst)
  const tap = erGevinst ? 0 : gevinstFoerSkjerming
  const skatt = skattAksjedel + Math.max(0, rentedelSkattEffekt)
  const skattEffekt = skattEffektAksjedel + rentedelSkattEffekt

  return {
    rente,
    inngangsverdi,
    ubenyttetInn: ubenyttet,
    grunnlag,
    skjerming,
    salgssum: nettoSalgssum,
    gevinstFoerSkjerming,
    erGevinst,
    aksjeandel: andel,
    aksjedelGevinst,
    rentedelGevinst,
    rentedelSkattEffekt,
    brukt,
    skattepliktig,
    tap,
    skatt,
    skattEffekt,
    bortfaltSkjerming,
  }
}

export function kr(n) {
  if (n == null || isNaN(n)) return '–'
  return Math.round(n).toLocaleString('nb-NO') + ' kr'
}

export function krDes(n) {
  if (n == null || isNaN(n)) return '–'
  return n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
}
