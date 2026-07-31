import { describe, it, expect } from 'vitest'
import { noekkelFor, utbytteIAar, beregnVPSPortefolje, beregnRealisertSalg, summerRealiserteSalg } from './skattemotor'
import { SISTE_AAR } from './skattekalkulator'

describe('noekkelFor', () => {
  it('bruker isin som nøkkel når det finnes', () => {
    expect(noekkelFor({ isin: 'NO0010096985', navn: 'Equinor' })).toBe('NO0010096985')
  })
  it('faller tilbake til navn når isin mangler', () => {
    expect(noekkelFor({ isin: null, navn: 'Equinor' })).toBe('Equinor')
    expect(noekkelFor({ isin: '', navn: 'Equinor' })).toBe('Equinor')
  })
})

describe('utbytteIAar', () => {
  const midtIAaret = Date.UTC(SISTE_AAR, 5, 15) / 1000
  const forrigeAar = Date.UTC(SISTE_AAR - 1, 5, 15) / 1000
  const tidligIAaret = Date.UTC(SISTE_AAR, 0, 5) / 1000

  it('summerer kun utbetalinger i skatteåret, ganget med antall aksjer', () => {
    const prisdata = { utbytter: [{ dato: midtIAaret, belop: 2 }, { dato: forrigeAar, belop: 1.8 }] }
    const r = utbytteIAar(prisdata, 100)
    expect(r.belop).toBe(200) // kun 2025-utbetalingen, ikke i fjor sin
    expect(r.antallUtbetalinger).toBe(1)
  })

  it('dekkerHeleAaret er true når eldste datapunkt er før årsskiftet', () => {
    const prisdata = { utbytter: [{ dato: midtIAaret, belop: 2 }, { dato: forrigeAar, belop: 1.8 }] }
    expect(utbytteIAar(prisdata, 100).dekkerHeleAaret).toBe(true)
  })

  it('dekkerHeleAaret er false når eldste datapunkt er midt i skatteåret (Yahoo sitt 12-mnd-vindu)', () => {
    const prisdata = { utbytter: [{ dato: tidligIAaret, belop: 2 }] }
    expect(utbytteIAar(prisdata, 100).dekkerHeleAaret).toBe(false)
  })

  it('returnerer 0 uten feil når data mangler', () => {
    expect(utbytteIAar(null, 100)).toEqual({ belop: 0, dekkerHeleAaret: false, antallUtbetalinger: 0 })
    expect(utbytteIAar({ utbytter: [] }, 100).belop).toBe(0)
    expect(utbytteIAar({ utbytter: [{ dato: midtIAaret, belop: 2 }] }, null).belop).toBe(0)
  })
})

describe('beregnVPSPortefolje', () => {
  const posisjoner = [
    { navn: 'Equinor', isin: 'NO001', antall: 10, gav: 300, konto_type: 'vps' },
    { navn: 'BlueNord (ASK)', isin: 'NO002', antall: 5, gav: 400, konto_type: 'ask' },
    { navn: 'GammelUtenType', isin: 'NO003', antall: 3, gav: 100, konto_type: null },
    { navn: 'ManglerGAV', isin: 'NO004', antall: 2, gav: null, konto_type: 'vps' },
  ]

  it('ekskluderer ASK-tagget posisjoner fra VPS-motoren', () => {
    const { rader, ikkeVPS } = beregnVPSPortefolje({ posisjoner, prisdata: null, skjermingRader: [] })
    expect(rader.map((r) => r.navn)).toEqual(['Equinor', 'GammelUtenType'])
    expect(ikkeVPS.map((r) => r.navn)).toEqual(['BlueNord (ASK)'])
  })

  it('behandler manglende konto_type (eldre data) som VPS for bakoverkompatibilitet', () => {
    const { rader } = beregnVPSPortefolje({ posisjoner, prisdata: null, skjermingRader: [] })
    expect(rader.some((r) => r.navn === 'GammelUtenType')).toBe(true)
  })

  it('legger posisjoner uten GAV i utenKostpris, ikke i rader', () => {
    const { rader, utenKostpris } = beregnVPSPortefolje({ posisjoner, prisdata: null, skjermingRader: [] })
    expect(rader.some((r) => r.navn === 'ManglerGAV')).toBe(false)
    expect(utenKostpris.map((p) => p.navn)).toContain('ManglerGAV')
  })

  it('bruker lagret ubenyttet skjerming kun når den gjelder inneværende skatteår', () => {
    const skjermingRader = [
      { noekkel: 'NO001', ubenyttet: 500, aar: SISTE_AAR },
      { noekkel: 'NO003', ubenyttet: 999, aar: SISTE_AAR - 1 }, // gammelt år — skal ignoreres
    ]
    const { rader } = beregnVPSPortefolje({ posisjoner, prisdata: null, skjermingRader })
    const equinor = rader.find((r) => r.navn === 'Equinor')
    const gammel = rader.find((r) => r.navn === 'GammelUtenType')
    expect(equinor.r.ubenyttetInn).toBe(500)
    expect(gammel.r.ubenyttetInn).toBe(0)
  })

  it('overstyrt utbytte/ubenyttet-verdi fra brukeren overstyrer autoverdien', () => {
    const { rader } = beregnVPSPortefolje({
      posisjoner, prisdata: null, skjermingRader: [],
      utbytteOverstyrt: { NO001: '1000' },
      ubenyttetOverstyrt: { NO001: '250' },
    })
    const equinor = rader.find((r) => r.navn === 'Equinor')
    expect(equinor.r.utbytte).toBe(1000)
    expect(equinor.r.ubenyttetInn).toBe(250)
  })
})

describe('beregnRealisertSalg / summerRealiserteSalg', () => {
  it('beregnRealisertSalg regner ut gevinst for ett lagret salg', () => {
    const salg = { kostpris: 10000, salgssum: 15000, salgskurtasje: 0, ubenyttet_skjerming: 500, aar: SISTE_AAR }
    const g = beregnRealisertSalg(salg)
    expect(g.gevinstFoerSkjerming).toBe(5000)
    expect(g.erGevinst).toBe(true)
  })

  it('summerer flere salg korrekt, inkludert et tap som ikke bruker skjerming', () => {
    const salgListe = [
      { kostpris: 10000, salgssum: 15000, salgskurtasje: 0, ubenyttet_skjerming: 500, aar: SISTE_AAR }, // gevinst
      { kostpris: 8000, salgssum: 6000, salgskurtasje: 0, ubenyttet_skjerming: 300, aar: SISTE_AAR },   // tap
    ]
    const tot = summerRealiserteSalg(salgListe)
    expect(tot.gevinstFoerSkjerming).toBe(5000 + (-2000))
    // Skjermingen fra tap-salget (300 × rente) skal telle som bortfalt, ikke brukt
    const g2 = beregnRealisertSalg(salgListe[1])
    expect(tot.bortfaltSkjerming).toBeCloseTo(g2.skjerming, 6)
  })

  it('returnerer nulltall for en tom liste', () => {
    expect(summerRealiserteSalg([])).toEqual({
      gevinstFoerSkjerming: 0, skattepliktig: 0, skatt: 0, skattEffekt: 0, bortfaltSkjerming: 0,
    })
    expect(summerRealiserteSalg(undefined)).toEqual({
      gevinstFoerSkjerming: 0, skattepliktig: 0, skatt: 0, skattEffekt: 0, bortfaltSkjerming: 0,
    })
  })
})
