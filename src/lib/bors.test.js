import { describe, it, expect } from 'vitest'
import { beregnRangePosisjon, slaSammenRader, filtrerOgSorter, grupperEtterSektor, beregnHoydepunkter, beregnSvgPunkter } from './bors'

describe('beregnRangePosisjon', () => {
  it('regner posisjon i intervallet 0-100', () => {
    expect(beregnRangePosisjon(150, 100, 200)).toBeCloseTo(50, 6)
    expect(beregnRangePosisjon(100, 100, 200)).toBeCloseTo(0, 6)
    expect(beregnRangePosisjon(200, 100, 200)).toBeCloseTo(100, 6)
  })
  it('klipper til 0-100 når prisen ligger utenfor 52-ukers intervallet (stale cache)', () => {
    expect(beregnRangePosisjon(250, 100, 200)).toBe(100)
    expect(beregnRangePosisjon(50, 100, 200)).toBe(0)
  })
  it('returnerer null når intervallet er ugyldig eller data mangler', () => {
    expect(beregnRangePosisjon(150, 100, 100)).toBeNull()
    expect(beregnRangePosisjon(null, 100, 200)).toBeNull()
    expect(beregnRangePosisjon(150, null, 200)).toBeNull()
  })
})

describe('slaSammenRader', () => {
  const univers = [
    { navn: 'Equinor', ticker: 'EQNR.OL', marked: 'no', sektor: 'energi' },
    { navn: 'Ukjent AS', ticker: 'UKJENT.OL', marked: 'no', sektor: 'annet' },
  ]
  it('markerer manglende/feilet data med harData:false i stedet for å fjerne raden', () => {
    const prisdata = { priser: { 'EQNR.OL': { pris: 300, valuta: 'NOK', dagEndringPst: 1.2, direkteavkastning: 4, femtitoUkeLav: 250, femtitoUkeHoy: 350 } } }
    const rader = slaSammenRader(univers, prisdata)
    expect(rader).toHaveLength(2)
    expect(rader[0].harData).toBe(true)
    expect(rader[0].pris).toBe(300)
    expect(rader[1].harData).toBe(false)
    expect(rader[1].pris).toBeNull()
  })
})

describe('filtrerOgSorter', () => {
  const rader = [
    { navn: 'B-aksje', marked: 'no', sektor: 'energi', pris: 100, direkteavkastning: 2 },
    { navn: 'A-aksje', marked: 'us', sektor: 'teknologi', pris: 300, direkteavkastning: null },
    { navn: 'C-aksje', marked: 'no', sektor: 'finans', pris: 50, direkteavkastning: 5 },
  ]
  it('filtrerer på marked', () => {
    const ut = filtrerOgSorter(rader, { marked: 'no' })
    expect(ut.map((r) => r.navn)).toEqual(['B-aksje', 'C-aksje'])
  })
  it('filtrerer på sektor', () => {
    const ut = filtrerOgSorter(rader, { sektor: 'teknologi' })
    expect(ut.map((r) => r.navn)).toEqual(['A-aksje'])
  })
  it('sorterer stigende og synkende', () => {
    expect(filtrerOgSorter(rader, { sortKolonne: 'pris', sortRetning: 'asc' }).map((r) => r.navn))
      .toEqual(['C-aksje', 'B-aksje', 'A-aksje'])
    expect(filtrerOgSorter(rader, { sortKolonne: 'pris', sortRetning: 'desc' }).map((r) => r.navn))
      .toEqual(['A-aksje', 'B-aksje', 'C-aksje'])
  })
  it('plasserer manglende verdier sist uansett sorteringsretning', () => {
    expect(filtrerOgSorter(rader, { sortKolonne: 'direkteavkastning', sortRetning: 'asc' }).at(-1).navn).toBe('A-aksje')
    expect(filtrerOgSorter(rader, { sortKolonne: 'direkteavkastning', sortRetning: 'desc' }).at(-1).navn).toBe('A-aksje')
  })
  it('returnerer tom liste når ingen rader matcher filteret', () => {
    expect(filtrerOgSorter(rader, { marked: 'asia' })).toEqual([])
  })

  it('filtrerer på søketekst i navn eller ticker', () => {
    const medTicker = [
      { navn: 'Equinor', ticker: 'EQNR.OL', marked: 'no', sektor: 'energi' },
      { navn: 'Apple', ticker: 'AAPL', marked: 'us', sektor: 'teknologi' },
    ]
    expect(filtrerOgSorter(medTicker, { sok: 'equi' }).map((r) => r.navn)).toEqual(['Equinor'])
    expect(filtrerOgSorter(medTicker, { sok: 'AAPL' }).map((r) => r.navn)).toEqual(['Apple'])
    expect(filtrerOgSorter(medTicker, { sok: '  ' }).map((r) => r.navn)).toEqual(['Apple', 'Equinor'])
    expect(filtrerOgSorter(medTicker, { sok: 'ingenting' })).toEqual([])
  })

  it('filtrerer på utbytte', () => {
    const medHarData = [
      { navn: 'Betaler', harData: true, direkteavkastning: 3.5 },
      { navn: 'Betaler-ikke', harData: true, direkteavkastning: 0 },
      { navn: 'Ukjent', harData: false, direkteavkastning: null },
    ]
    expect(filtrerOgSorter(medHarData, { utbytte: 'med' }).map((r) => r.navn)).toEqual(['Betaler'])
    expect(filtrerOgSorter(medHarData, { utbytte: 'uten' }).map((r) => r.navn)).toEqual(['Betaler-ikke'])
    // Rader uten data ennå (harData:false) havner i ingen av gruppene — vi vet ikke om de betaler utbytte
    expect(filtrerOgSorter(medHarData, { utbytte: 'alle' }).map((r) => r.navn)).toEqual(['Betaler', 'Betaler-ikke', 'Ukjent'])
  })
})

describe('grupperEtterSektor', () => {
  const rader = [
    { navn: 'A', sektor: 'energi' },
    { navn: 'B', sektor: 'finans' },
    { navn: 'C', sektor: 'energi' },
  ]
  it('grupperer i den oppgitte rekkefølgen og utelater tomme grupper', () => {
    const grupper = grupperEtterSektor(rader, ['finans', 'energi', 'teknologi'])
    expect(grupper.map((g) => g.sektor)).toEqual(['finans', 'energi'])
    expect(grupper[1].rader.map((r) => r.navn)).toEqual(['A', 'C'])
  })
})

describe('beregnSvgPunkter', () => {
  it('skalerer prisserien til viewBox-koordinater', () => {
    const serie = [{ dato: 1, pris: 100 }, { dato: 2, pris: 150 }, { dato: 3, pris: 100 }]
    const punkter = beregnSvgPunkter(serie, 100, 50)
    expect(punkter).toBe('0.0,50.0 50.0,0.0 100.0,50.0')
  })
  it('returnerer tom streng for for få punkter', () => {
    expect(beregnSvgPunkter([], 100, 50)).toBe('')
    expect(beregnSvgPunkter([{ dato: 1, pris: 100 }], 100, 50)).toBe('')
  })
  it('håndterer flat serie (samme pris hele veien) uten å dele på null', () => {
    const serie = [{ dato: 1, pris: 100 }, { dato: 2, pris: 100 }]
    expect(beregnSvgPunkter(serie, 100, 50)).toBe('0.0,50.0 100.0,50.0')
  })
})

describe('beregnHoydepunkter', () => {
  it('finner vinner, taper og høyest direkteavkastning', () => {
    const rader = [
      { navn: 'A', dagEndringPst: 1.2, direkteavkastning: 2 },
      { navn: 'B', dagEndringPst: -3.1, direkteavkastning: null },
      { navn: 'C', dagEndringPst: 4.8, direkteavkastning: 9.4 },
    ]
    const h = beregnHoydepunkter(rader)
    expect(h.vinner.navn).toBe('C')
    expect(h.taper.navn).toBe('B')
    expect(h.hoyestAvkastning.navn).toBe('C')
    expect(h.antall).toBe(3)
  })
  it('returnerer null når ingen rader har data', () => {
    const h = beregnHoydepunkter([{ navn: 'A', dagEndringPst: null, direkteavkastning: null }])
    expect(h.vinner).toBeNull()
    expect(h.taper).toBeNull()
    expect(h.hoyestAvkastning).toBeNull()
  })
})
