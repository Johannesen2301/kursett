import { describe, it, expect } from 'vitest'
import { beregnVPS, beregnFondVPS, beregnASK, beregnGevinstVedSalg, beregnFondGevinstVedSalg, SISTE_AAR, SKJERMINGSRENTE, EFFEKTIV_SATS, SATS_ALMINNELIG } from './skattekalkulator'

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

describe('beregnFondVPS', () => {
  // Terskelregelen er verifisert direkte mot Skatteetatens side «Beskatning
  // av andeler i verdipapirfond»: >80 % aksjeandel = ren aksjelogikk,
  // <20 % = ren renteinntekt (22 %, ingen skjerming), 20–80 % = forholdsmessig
  // splitting. Se kommentaren over beregnFondVPS i skattekalkulator.js.

  it('regner som et rent aksjefond (uendret beregnVPS) når aksjeandelen er over 80 %', () => {
    const fond = beregnFondVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 500, aksjeandel: 90 })
    const aksje = beregnVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 500 })
    expect(fond.skjerming).toBeCloseTo(aksje.skjerming, 6)
    expect(fond.skattepliktig).toBeCloseTo(aksje.skattepliktig, 6)
    expect(fond.skatt).toBeCloseTo(aksje.skatt, 6)
    expect(fond.rentedelUtbytte).toBe(0)
  })

  it('regner hele avkastningen som renteinntekt (22 %, ingen skjerming) når aksjeandelen er under 20 %', () => {
    const r = beregnFondVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 500, aksjeandel: 10 })
    expect(r.aksjedelUtbytte).toBe(0)
    expect(r.rentedelUtbytte).toBe(500)
    expect(r.skattepliktig).toBe(500)
    expect(r.skatt).toBeCloseTo(500 * (SATS_ALMINNELIG / 100), 6)
    // Skjermingen er likevel beregnet på full grunnlag og fremføres i sin
    // helhet, siden ingen del av utbyttet i år var en aksjedel å nette den mot
    // — akkurat som en vanlig aksje som ikke betalte utbytte dette året.
    expect(r.brukt).toBe(0)
    expect(r.nyUbenyttet).toBeCloseTo(r.skjerming, 6)
  })

  it('splitter utbyttet forholdsmessig mellom 20 % og 80 % aksjeandel, med skjerming kun mot aksjedelen', () => {
    const r = beregnFondVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 1000, aksjeandel: 40 })
    expect(r.aksjedelUtbytte).toBeCloseTo(400, 6)
    expect(r.rentedelUtbytte).toBeCloseTo(600, 6)
    const forventetSkjerming = 10000 * (RENTE / 100)
    const brukt = Math.min(forventetSkjerming, 400)
    const skattepliktigAksjedel = Math.max(0, 400 - forventetSkjerming)
    const forventetSkatt = skattepliktigAksjedel * (EFFEKTIV_SATS / 100) + 600 * (SATS_ALMINNELIG / 100)
    expect(r.brukt).toBeCloseTo(brukt, 6)
    expect(r.skattepliktig).toBeCloseTo(skattepliktigAksjedel + 600, 6)
    expect(r.skatt).toBeCloseTo(forventetSkatt, 6)
  })

  it('bruker den forholdsmessige splitten (ikke alt-eller-ingenting) nøyaktig på 20 % og 80 %-grensene', () => {
    const paa20 = beregnFondVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 1000, aksjeandel: 20 })
    expect(paa20.aksjedelUtbytte).toBeCloseTo(200, 6)
    expect(paa20.rentedelUtbytte).toBeCloseTo(800, 6)

    const paa80 = beregnFondVPS({ kostpris: 10000, ubenyttetSkjerming: 0, utbytte: 1000, aksjeandel: 80 })
    expect(paa80.aksjedelUtbytte).toBeCloseTo(800, 6)
    expect(paa80.rentedelUtbytte).toBeCloseTo(200, 6)
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

describe('beregnFondGevinstVedSalg', () => {
  // Samme 20/80-terskelregel som beregnFondVPS, men på gevinst/tap ved salg.
  // Aksjeandelen som sendes inn skal være SNITTET av kjøpsår og salgsår —
  // det er UI-lagets/kallerens ansvar å regne ut det snittet.

  it('regner som et rent aksjesalg (uendret beregnGevinstVedSalg) når aksjeandelen er over 80 %', () => {
    const fond = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 15000, ubenyttetSkjerming: 500, aksjeandel: 90 })
    const aksje = beregnGevinstVedSalg({ kostpris: 10000, salgssum: 15000, ubenyttetSkjerming: 500 })
    expect(fond.skattepliktig).toBeCloseTo(aksje.skattepliktig, 6)
    expect(fond.skatt).toBeCloseTo(aksje.skatt, 6)
    expect(fond.rentedelGevinst).toBe(0)
  })

  it('regner hele gevinsten som renteinntekt (22 %, ingen skjerming) når aksjeandelen er under 20 %', () => {
    const r = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 15000, ubenyttetSkjerming: 500, aksjeandel: 10 })
    expect(r.aksjedelGevinst).toBe(0)
    expect(r.rentedelGevinst).toBe(5000)
    expect(r.skattepliktig).toBe(5000)
    expect(r.skatt).toBeCloseTo(5000 * (SATS_ALMINNELIG / 100), 6)
    expect(r.brukt).toBe(0)
    // All skjerming går tapt siden ingen del av gevinsten var en aksjedel å nette den mot
    expect(r.bortfaltSkjerming).toBeCloseTo(r.skjerming, 6)
  })

  it('splitter gevinsten forholdsmessig mellom 20 % og 80 % aksjeandel, med skjerming kun mot aksjedelen', () => {
    const r = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 20000, ubenyttetSkjerming: 0, aksjeandel: 40 })
    expect(r.gevinstFoerSkjerming).toBe(10000)
    expect(r.aksjedelGevinst).toBeCloseTo(4000, 6)
    expect(r.rentedelGevinst).toBeCloseTo(6000, 6)
    const forventetSkjerming = 10000 * (RENTE / 100)
    const skattepliktigAksjedel = Math.max(0, 4000 - forventetSkjerming)
    const forventetSkatt = skattepliktigAksjedel * (EFFEKTIV_SATS / 100) + 6000 * (SATS_ALMINNELIG / 100)
    expect(r.skattepliktig).toBeCloseTo(skattepliktigAksjedel + 6000, 6)
    expect(r.skatt).toBeCloseTo(forventetSkatt, 6)
  })

  it('splitter et TAP forholdsmessig også, med separat skattebesparelse for aksjedel (37,84 %) og rentedel (22 %)', () => {
    const r = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 6000, ubenyttetSkjerming: 0, aksjeandel: 40 })
    expect(r.erGevinst).toBe(false)
    expect(r.tap).toBe(-4000)
    expect(r.brukt).toBe(0)
    expect(r.skattepliktig).toBe(0)
    const forventetSkattEffekt = -1600 * (EFFEKTIV_SATS / 100) + -2400 * (SATS_ALMINNELIG / 100)
    expect(r.skattEffekt).toBeCloseTo(forventetSkattEffekt, 6)
  })

  it('bruker den forholdsmessige splitten (ikke alt-eller-ingenting) nøyaktig på 20 % og 80 %-grensene', () => {
    const paa20 = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 20000, aksjeandel: 20 })
    expect(paa20.aksjedelGevinst).toBeCloseTo(2000, 6)
    const paa80 = beregnFondGevinstVedSalg({ kostpris: 10000, salgssum: 20000, aksjeandel: 80 })
    expect(paa80.aksjedelGevinst).toBeCloseTo(8000, 6)
  })
})
