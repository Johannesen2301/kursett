import { decode, detectDelimiter, num } from './nordnet'

// Interne overføringer mellom egne Nordnet-kontoer bokføres som INNSKUDD/UTTAK
// på lik linje med ekte innskudd/uttak — de skal IKKE telle med i skjermingsgrunnlaget.
const INTERN_PREFIX = /^internal\s/i

export function parseTransaksjonerCSV(buf) {
  const text = decode(buf).replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) throw new Error('Fant ingen rader i fila. Er dette et riktig kontoutdrag/transaksjonseksport?')
  const delim = detectDelimiter(lines[0])
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, '')))
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const findCol = (cands) => {
    for (const c of cands) { const i = header.findIndex((h) => h === c); if (i >= 0) return i }
    for (const c of cands) { const i = header.findIndex((h) => h.includes(c)); if (i >= 0) return i }
    return -1
  }
  const iDato = findCol(['bokføringsdag', 'bokforingsdag'])
  const iType = findCol(['transaksjonstype'])
  const iBelop = findCol(['beløp', 'belop'])
  const iTekst = findCol(['transaksjonstekst'])
  if (iDato < 0 || iType < 0 || iBelop < 0 || iTekst < 0) {
    throw new Error('Fant ikke forventede kolonner (bokføringsdag/transaksjonstype/beløp/transaksjonstekst). Kolonnene i fila var: ' + header.join(', '))
  }

  const transaksjoner = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const type = (row[iType] || '').trim().toUpperCase()
    if (!type.includes('INNSKUDD') && !type.includes('UTTAK')) continue
    const tekst = (row[iTekst] || '').trim()
    if (INTERN_PREFIX.test(tekst)) continue // intern overføring — teller ikke
    const belop = num(row[iBelop])
    const dato = (row[iDato] || '').trim()
    if (belop == null || !dato) continue
    transaksjoner.push({ dato, belop, tekst })
  }
  transaksjoner.sort((a, b) => a.dato.localeCompare(b.dato))
  return {
    transaksjoner,
    forsteDato: transaksjoner[0]?.dato ?? null,
    sisteDato: transaksjoner[transaksjoner.length - 1]?.dato ?? null,
  }
}

/**
 * Laveste innskuddssaldo for et gitt år: startsaldo (rett før første
 * transaksjon i fila) + løpende sum av eksterne innskudd/uttak, med sporing
 * av bunnpunktet.
 */
export function beregnLavesteSaldo({ transaksjoner, startSaldo = 0, aar }) {
  const start = Number(startSaldo) || 0
  const iAret = transaksjoner.filter((t) => t.dato.slice(0, 4) === String(aar))
  let saldo = start
  let laveste = start
  for (const t of iAret) {
    saldo += t.belop
    if (saldo < laveste) laveste = saldo
  }
  return {
    laveste,
    sluttSaldo: saldo,
    antall: iAret.length,
    forsteDato: iAret[0]?.dato ?? null,
    sisteDato: iAret[iAret.length - 1]?.dato ?? null,
  }
}
