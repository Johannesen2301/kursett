import { describe, it, expect } from 'vitest'
import { tidSiden, merkMedSelskap } from './nyheter'

describe('tidSiden', () => {
  const naa = 1_000_000
  it('formaterer minutter, timer og dager', () => {
    expect(tidSiden(naa - 30, naa)).toBe('akkurat nå')
    expect(tidSiden(naa - 5 * 60, naa)).toBe('5 min siden')
    expect(tidSiden(naa - 3 * 3600, naa)).toBe('3 t siden')
    expect(tidSiden(naa - 2 * 86400, naa)).toBe('2 d siden')
  })
  it('faller tilbake til dato for gamle saker', () => {
    expect(tidSiden(naa - 20 * 86400, naa)).not.toMatch(/siden/)
  })
  it('returnerer tom streng når tid mangler', () => {
    expect(tidSiden(null)).toBe('')
  })
})

describe('merkMedSelskap', () => {
  it('merker saker med navn på selskaper brukeren eier', () => {
    const nyheter = [
      { uuid: '1', relaterteTickere: ['EQNR.OL', 'AAPL'] },
      { uuid: '2', relaterteTickere: ['UKJENT.OL'] },
    ]
    const ut = merkMedSelskap(nyheter, { 'EQNR.OL': 'Equinor' })
    expect(ut[0].gjelderNavn).toEqual(['Equinor'])
    expect(ut[1].gjelderNavn).toEqual([])
  })
})
