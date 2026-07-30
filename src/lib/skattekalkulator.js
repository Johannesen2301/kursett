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
 */
export function beregnVPS({ kostpris, kurtasje = 0, ubenyttetSkjerming = 0, utbytte = 0, aar = SISTE_AAR }) {
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
  const skatt = skattepliktig * (EFFEKTIV_SATS / 100)
  const utenSkjerming = mottattUtbytte * (EFFEKTIV_SATS / 100)
  const spart = utenSkjerming - skatt

  return {
    rente,
    inngangsverdi,
    ubenyttetInn: ubenyttet,
    grunnlag,
    skjerming,
    utbytte: mottattUtbytte,
    brukt,
    skattepliktig,
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

export function kr(n) {
  if (n == null || isNaN(n)) return '–'
  return Math.round(n).toLocaleString('nb-NO') + ' kr'
}

export function krDes(n) {
  if (n == null || isNaN(n)) return '–'
  return n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
}
