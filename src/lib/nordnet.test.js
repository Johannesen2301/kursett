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

describe('parseNordnetCSV — kolonnegjenkjenning på tvers av meglere', () => {
  // Kolonnematchingen er ikke faktisk Nordnet-spesifikk — den leter etter
  // vanlige norske/engelske finansbegreper. Disse testene bekrefter at en
  // annen megler enn Nordnet (eller en engelskspråklig eksport) sannsynligvis
  // fungerer uten endringer, selv om vi ikke har en ekte fil å teste mot.
  it('gjenkjenner engelske kolonnenavn (Name/Quantity/Price/Market Value/Cost price)', () => {
    const csv = csvBuf([
      'Name,ISIN,Quantity,Price,Market Value,Cost price',
      'Equinor,NO0010096985,10,300,3000,250',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions[0]).toMatchObject({ navn: 'Equinor', isin: 'NO0010096985', antall: 10, gav: 250 })
  })

  it('gjenkjenner alternative norske kolonnenavn (Instrument/Beholdning/Snittkurs)', () => {
    const csv = csvBuf([
      'Instrument;ISIN;Beholdning;Markedsverdi;Snittkurs',
      'Telenor;NO0010063308;20;3000;140',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions[0]).toMatchObject({ navn: 'Telenor', antall: 20, gav: 140 })
  })

  it('regner ut markedsverdi fra antall × kurs når fila mangler en egen markedsverdi-kolonne', () => {
    const csv = csvBuf(['Verdipapir;Antall;Kurs', 'Equinor;10;300'])
    const { positions } = parseNordnetCSV(csv)
    expect(positions[0].markedsverdi).toBe(3000)
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

  it('utelater GAV for posisjonen når noen, men ikke alle, lotter mangler GAV (regresjonstest)', () => {
    // Før denne fiksen ble GAV regnet som et vektet snitt av KUN lottene som
    // hadde GAV, men ganget med FULL antall (inkl. lotten uten GAV) lenger nede
    // i portfolio.js. Det ga et stille galt kostpris-tall. Med fiksen skal hele
    // posisjonens GAV bli null i stedet for å gjette.
    const csv = csvBuf([
      'Verdipapir;ISIN;Antall;Sluttkurs;Markedsverdi;GAV',
      'BlueNord;NO0010828585;100;520;52000;50',
      'BlueNord;NO0010828585;50;520;26000;',
    ])
    const { positions } = parseNordnetCSV(csv)
    expect(positions).toHaveLength(1)
    expect(positions[0].antall).toBe(150)
    expect(positions[0].gav).toBeNull()
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
