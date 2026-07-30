import { describe, it, expect } from 'vitest'
import { parseNordnetCSV, num } from './nordnet'

function csvBuf(rows) {
  return new TextEncoder().encode(rows.join('\n')).buffer
}

describe('num', () => {
  it('tolker norsk tallformat (komma som desimal, punktum som tusenskille)', () => {
    expect(num('1.234,56')).toBeCloseTo(1234.56, 6)
    expect(num('180,50')).toBeCloseTo(180.5, 6)
  })
  it('returnerer null for tomme/ugyldige verdier', () => {
    expect(num('')).toBeNull()
    expect(num('-')).toBeNull()
    expect(num(null)).toBeNull()
  })
})

describe('parseNordnetCSV — sammenslåing av flere lot-rader (regresjonstest)', () => {
  // Nordnet lister ofte samme aksje flere ganger (én rad per anskaffelseslot).
  // Før denne fiksen ble hver rad vist som en egen "posisjon" i porteføljen —
  // f.eks. viste Iberdrola seg tre ganger i stedet for én gang med riktig sum.
  it('slår sammen flere rader med samme ISIN til én posisjon med summert antall/verdi', () => {
    const csv = csvBuf([
      'Verdipapir;ISIN;Antall;Sluttkurs;Markedsverdi;GAV',
      'BlueNord;NO0010828585;37;520;19240;500',
      'BlueNord;NO0010828585;20;520;10400;480',
      'BlueNord;NO0010828585;14;520;7280;510',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions).toHaveLength(1)
    expect(positions[0].navn).toBe('BlueNord')
    expect(positions[0].antall).toBe(71) // 37 + 20 + 14
    expect(positions[0].markedsverdi).toBeCloseTo(19240 + 10400 + 7280, 6)
  })

  it('regner et kvantitetsvektet snitt-GAV over lottene, ikke et enkelt/siste tall', () => {
    const csv = csvBuf([
      'Verdipapir;ISIN;Antall;Sluttkurs;Markedsverdi;GAV',
      'Equinor;NO0010096985;10;300;3000;200',
      'Equinor;NO0010096985;10;300;3000;300',
    ])
    const { positions } = parseNordnetCSV(csv)
    // (10*200 + 10*300) / 20 = 250
    expect(positions[0].gav).toBeCloseTo(250, 6)
  })

  it('holder ulike aksjer som separate posisjoner (grupperer kun på lik nøkkel)', () => {
    const csv = csvBuf([
      'Verdipapir;ISIN;Antall;Sluttkurs;Markedsverdi;GAV',
      'Equinor;NO0010096985;10;300;3000;250',
      'Telenor;NO0010063308;5;150;750;140',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions).toHaveLength(2)
    expect(positions.map((p) => p.navn).sort()).toEqual(['Equinor', 'Telenor'])
  })

  it('grupperer på navn (små bokstaver) når ISIN mangler i fila', () => {
    const csv = csvBuf([
      'Verdipapir;Antall;Sluttkurs;Markedsverdi;GAV',
      'Equinor;10;300;3000;250',
      'Equinor;5;300;1500;260',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions).toHaveLength(1)
    expect(positions[0].antall).toBe(15)
  })

  it('kaster en tydelig feil når ingen rader har en verdi over null', () => {
    const csv = csvBuf(['Verdipapir;Antall;Markedsverdi', 'Tom posisjon;0;0'])
    expect(() => parseNordnetCSV(csv)).toThrow(/Fant ingen posisjoner/)
  })

  it('kaster en tydelig feil når forventede kolonner mangler helt', () => {
    const csv = csvBuf(['Verdipapir;Antall', 'Ukjent;0'])
    expect(() => parseNordnetCSV(csv)).toThrow(/Fant verken markedsverdi/)
  })
})
