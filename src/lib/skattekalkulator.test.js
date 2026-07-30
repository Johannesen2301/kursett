import { describe, it, expect } from 'vitest'
import { beregnVPS, beregnASK, beregnGevinstVedSalg, SISTE_AAR, SKJERMINGSRENTE, EFFEKTIV_SATS } from './skattekalkulator'

const RENTE = SKJERMINGSRENTE[SISTE_AAR]

describe('beregnVPS', () => {
  it('regner ut skjerming, skattepliktig utbytte og skatt korrekt', () => {
    const r = beregnVPS({ kostpris: 10000, kurtasje: 0, ubenyttetSkjerming: 0, utbytte: 500 })
    const forventetSkjerming = 10000 * (RENTE / 100)
    expect(r.skjerming).toBeCloseTo(forventetSkjerming, 6)
    expect(r.skattepliktig).toBeCloseTo(500 - forventetSkjerming, 6)
    expect(r.skatt).toBeCloseTo(r.skattepliktig * (EFFEKTIV_SATS / 100), 6)
    expect(r.nyUbenyttet).toBe(0)
  })

  it('fremfører ubenyttet skjerming når skjermingen er større enn utbyttet', () => {
    const r = beregnVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 50 })
    expect(r.skattepliktig).toBe(0)
    expect(r.nyUbenyttet).toBeCloseTo(r.skjerming - 50, 6)
    expect(r.nyttGrunnlag).toBeCloseTo(r.grunnlag + r.nyUbenyttet, 6)
  })

  it('legger ubenyttet skjerming fra i fjor til grunnlaget (rentes-rente-effekt)', () => {
    const utenUbenyttet = beregnVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 0 })
    const medUbenyttet = beregnVPS({ kostpris: 10000, ubenyttetSkjerming: 1000, utbytte: 0 })
    expect(medUbenyttet.grunnlag).toBe(11000)
    expect(medUbenyttet.skjerming).toBeGreaterThan(utenUbenyttet.skjerming)
  })

  it('kurtasje legges til kostprisen i inngangsverdien', () => {
    const r = beregnVPS({ kostpris: 10000, kurtasje: 200, ubenyttetSkjerming: 0, utbytte: 0 })
    expect(r.inngangsverdi).toBe(10200)
  })
})

describe('beregnASK', () => {
  it('bruker laveste innskuddssaldo som grunnlag, ikke uttak eller beholdning', () => {
    const r = beregnASK({ lavesteInnskudd: 20000, ubenyttetSkjerming: 0, uttak: 0 })
    expect(r.grunnlag).toBe(20000)
    expect(r.skjerming).toBeCloseTo(20000 * (RENTE / 100), 6)
  })

  it('skattlegger uttak utover skjerming, ikke uttak i seg selv', () => {
    const r = beregnASK({ lavesteInnskudd: 10000, ubenyttetSkjerming: 0, uttak: 100 })
    expect(r.skattepliktig).toBeCloseTo(Math.max(0, 100 - r.skjerming), 6)
  })
})

describe('beregnGevinstVedSalg', () => {
  it('trekker skjerming fra en gevinst som er større enn skjermingen', () => {
    const r = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 15000, ubenyttetSkjerming: 500 })
    expect(r.erGevinst).toBe(true)
    expect(r.gevinstFoerSkjerming).toBe(5000)
    expect(r.skattepliktig).toBeCloseTo(5000 - r.skjerming, 6)
    expect(r.bortfaltSkjerming).toBe(0)
  })

  it('lar overskytende skjerming bortfalle når gevinsten er mindre enn skjermingen (fremføres IKKE)', () => {
    const r = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 10200, ubenyttetSkjerming: 500 })
    expect(r.gevinstFoerSkjerming).toBe(200)
    expect(r.skattepliktig).toBe(0)
    expect(r.bortfaltSkjerming).toBeCloseTo(r.skjerming - 200, 6)
    expect(r.nyUbenyttet).toBeUndefined() // finnes ikke — skal ikke fremføres som ved utbytte
  })

  it('bruker ALDRI skjerming mot et tap, og øker det aldri', () => {
    const r = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 8000, ubenyttetSkjerming: 500 })
    expect(r.erGevinst).toBe(false)
    expect(r.tap).toBe(-2000)
    expect(r.brukt).toBe(0)
    expect(r.skattepliktig).toBe(0)
    // Hele skjermingen går tapt siden det ikke var noen gevinst å bruke den mot
    expect(r.bortfaltSkjerming).toBeCloseTo(r.skjerming, 6)
  })

  it('gir en negativ skattEffekt (skattebesparelse) ved tap', () => {
    const r = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 8000 })
    expect(r.skattEffekt).toBeLessThan(0)
    expect(r.skattEffekt).toBeCloseTo(-2000 * (EFFEKTIV_SATS / 100), 6)
  })

  it('null gevinst (break-even) bruker ingen skjerming og gir intet tap', () => {
    const r = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 10000, ubenyttetSkjerming: 500 })
    expect(r.erGevinst).toBe(false)
    expect(r.tap).toBe(0)
    expect(r.skattepliktig).toBe(0)
  })
})
