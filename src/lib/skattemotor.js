// Skattemotoren — regner skjermingsfradrag automatisk for hele VPS-porteføljen.
//
// ASK er kontobasert (laveste innskuddssaldo, ikke per aksje) og håndteres
// fortsatt manuelt i Kalkulator.jsx. Denne motoren dekker kun VPS.
//
// Utbytte per aksje hentes fra faktisk utbetalingshistorikk (Yahoo Finance,
// via edge-funksjonen «priser»), ikke et anslag. Yahoo gir kun siste 12
// måneder — dekker IKKE nødvendigvis hele skatteåret hvis det er lenge siden
// årsskiftet. Se dekkerHeleAaret.

import { beregnVPS, beregnGevinstVedSalg, SISTE_AAR } from './skattekalkulator'
import { finnTicker } from './tickers'

const AAR_START = Date.UTC(SISTE_AAR, 0, 1) / 1000
const AAR_SLUTT = Date.UTC(SISTE_AAR, 11, 31, 23, 59, 59) / 1000

// isin er den stabile nøkkelen (posisjoner slettes/gjenopprettes ved hver
// import). Fallback til navn hvis CSV-en mangler isin-kolonne.
export function noekkelFor(posisjon) {
  const isin = (posisjon.isin || '').trim()
  return isin || posisjon.navn
}

// Summerer faktiske utbytteutbetalinger i skatteåret, ganget med antall
// aksjer eid nå. Fanger ikke opp kjøp/salg i løpet av året.
export function utbytteIAar(prisdata, antall) {
  if (!prisdata?.utbytter?.length || !antall) {
    return { belop: 0, dekkerHeleAaret: false, antallUtbetalinger: 0 }
  }
  const iAar = prisdata.utbytter.filter((u) => u.dato >= AAR_START && u.dato <= AAR_SLUTT)
  const eldste = Math.min(...prisdata.utbytter.map((u) => u.dato))
  const belop = iAar.reduce((s, u) => s + (u.belop || 0), 0) * antall
  return { belop, dekkerHeleAaret: eldste <= AAR_START, antallUtbetalinger: iAar.length }
}

// Regner ut skjermingsfradrag per VPS-posisjon i hele porteføljen. Delt mellom
// Min skatt (redigerbar visning) og Rådgiveren (kontekst til AI-svar), slik at
// begge alltid viser nøyaktig de samme tallene.
export function beregnVPSPortefolje({ posisjoner, prisdata, skjermingRader, utbytteOverstyrt = {}, ubenyttetOverstyrt = {} }) {
  const priser = prisdata?.priser || {}
  const fx = prisdata?.fx || { NOK: 1 }
  const skjermingMap = new Map((skjermingRader || []).map((r) => [r.noekkel, r]))
  const rader = []
  const utenKostpris = []
  const ikkeVPS = []

  for (const p of posisjoner || []) {
    // Eldre importerte posisjoner mangler konto_type — de behandles som VPS for
    // bakoverkompatibilitet (alt ble antatt VPS før flere-kontoer-støtten kom).
    if (p.konto_type === 'ask') { ikkeVPS.push(p); continue }
    if (p.antall == null) continue
    if (p.gav == null) { utenKostpris.push(p); continue }

    const noekkel = noekkelFor(p)
    const ticker = p.ticker || finnTicker(p.navn)
    const pd = ticker ? priser[ticker] : null
    const fxKurs = pd?.valuta ? (fx[pd.valuta] || 1) : 1

    const lagret = skjermingMap.get(noekkel)
    const ubenyttetAuto = lagret && lagret.aar === SISTE_AAR ? Number(lagret.ubenyttet) || 0 : 0

    const ut = utbytteIAar(pd, p.antall)
    const utbytteAutoNOK = ut.belop * fxKurs

    const utbytteStr = utbytteOverstyrt[noekkel]
    const utbytte = utbytteStr !== undefined ? (Number(utbytteStr) || 0) : utbytteAutoNOK

    const ubenyttetStr = ubenyttetOverstyrt[noekkel]
    const ubenyttetInn = ubenyttetStr !== undefined ? (Number(ubenyttetStr) || 0) : ubenyttetAuto

    const r = beregnVPS({
      kostpris: p.gav * p.antall,
      kurtasje: 0,
      ubenyttetSkjerming: ubenyttetInn,
      utbytte,
      aar: SISTE_AAR,
    })

    // Hypotetisk «hvis du selger i dag»-projeksjon — bruker samme ubenyttetInn
    // som utbytteberegningen over. De to er ALTERNATIVER (du får enten utbytte
    // og fremfører ubenyttet skjerming, ELLER selger og skjermingen bortfaller),
    // ikke noe som skal legges sammen med totalene i Min skatt.
    const harLivePris = !!pd?.pris && !pd.feil
    const verdiNaa = harLivePris ? pd.pris * fxKurs * p.antall : (p.markedsverdi ?? null)
    const g = verdiNaa != null ? beregnGevinstVedSalg({
      kostpris: p.gav * p.antall,
      kurtasje: 0,
      salgssum: verdiNaa,
      ubenyttetSkjerming: ubenyttetInn,
      aar: SISTE_AAR,
    }) : null

    rader.push({
      noekkel, navn: p.navn, isin: p.isin, antall: p.antall,
      fantData: !!pd && !pd.feil,
      utbytteAutoNOK,
      utbytteFelt: utbytteStr !== undefined ? utbytteStr : (utbytteAutoNOK > 0 ? String(Math.round(utbytteAutoNOK)) : ''),
      dekkerHeleAaret: ut.dekkerHeleAaret,
      ubenyttetFelt: ubenyttetStr !== undefined ? ubenyttetStr : (ubenyttetAuto > 0 ? String(Math.round(ubenyttetAuto)) : ''),
      r,
      verdiNaa, harLivePris, g,
    })
  }
  return { rader, utenKostpris, ikkeVPS }
}

// Regner ut gevinst/tap for ETT lagret, faktisk salg (ikke en hypotese som
// «hvis du selger i dag»). Ren wrapper rundt beregnGevinstVedSalg som gjør
// om lagrede felter til riktig input.
export function beregnRealisertSalg(salg) {
  return beregnGevinstVedSalg({
    kostpris: salg.kostpris,
    kurtasje: 0,
    salgssum: salg.salgssum,
    salgskurtasje: salg.salgskurtasje,
    ubenyttetSkjerming: salg.ubenyttet_skjerming,
    aar: salg.aar,
  })
}

// Summerer skattepliktig gevinst, skatt og bortfalt skjerming over flere
// realiserte salg i året — brukes til totalen øverst i Min skatt.
export function summerRealiserteSalg(salgListe) {
  return (salgListe || []).reduce((s, salg) => {
    const g = beregnRealisertSalg(salg)
    return {
      gevinstFoerSkjerming: s.gevinstFoerSkjerming + g.gevinstFoerSkjerming,
      skattepliktig: s.skattepliktig + g.skattepliktig,
      skatt: s.skatt + g.skatt,
      skattEffekt: s.skattEffekt + g.skattEffekt,
      bortfaltSkjerming: s.bortfaltSkjerming + g.bortfaltSkjerming,
    }
  }, { gevinstFoerSkjerming: 0, skattepliktig: 0, skatt: 0, skattEffekt: 0, bortfaltSkjerming: 0 })
}

export async function hentRealiserteSalg(supabase, aar = SISTE_AAR) {
  const { data, error } = await supabase.from('realiserte_salg').select('*').eq('aar', aar).order('dato', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function lagreRealisertSalg(supabase, brukerId, salg) {
  const { error } = await supabase.from('realiserte_salg').insert({
    bruker_id: brukerId,
    noekkel: salg.noekkel,
    navn: salg.navn,
    antall: salg.antall,
    kostpris: salg.kostpris,
    salgssum: salg.salgssum,
    salgskurtasje: salg.salgskurtasje || 0,
    ubenyttet_skjerming: salg.ubenyttet_skjerming || 0,
    dato: salg.dato,
    aar: salg.aar,
  })
  if (error) throw new Error(error.message)
}

export async function slettRealisertSalg(supabase, id) {
  const { error } = await supabase.from('realiserte_salg').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function hentSkjermingRader(supabase) {
  const { data, error } = await supabase.from('skjerming').select('*')
  if (error) throw new Error(error.message)
  return data || []
}

// Lagrer ubenyttet skjerming per aksje, tagget med året den gjelder som
// inngangsverdi for (dvs. neste skatteår).
export async function lagreSkjerming(supabase, brukerId, poster) {
  const rader = poster.map((p) => ({
    bruker_id: brukerId,
    noekkel: p.noekkel,
    navn: p.navn,
    ubenyttet: p.ubenyttet,
    aar: p.aar,
    oppdatert: new Date().toISOString(),
  }))
  const { error } = await supabase.from('skjerming').upsert(rader, { onConflict: 'bruker_id,noekkel' })
  if (error) throw new Error(error.message)
}
