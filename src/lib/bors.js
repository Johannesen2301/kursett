// Ren logikk for Børs-screeneren — filter/sortering/merge, uavhengig av React og nettverk.
export function beregnRangePosisjon(pris, lav, hoy) {
  if (pris == null || lav == null || hoy == null || hoy <= lav) return null
  const pst = ((pris - lav) / (hoy - lav)) * 100
  return Math.max(0, Math.min(100, pst))
}

export function slaSammenRader(univers, prisdata) {
  const priser = prisdata?.priser || {}
  return univers.map((u) => {
    const pd = priser[u.ticker]
    const harData = !!(pd && pd.pris != null && !pd.feil)
    return {
      ...u,
      harData,
      pris: harData ? pd.pris : null,
      valuta: harData ? pd.valuta : null,
      dagEndringPst: harData ? pd.dagEndringPst : null,
      direkteavkastning: harData ? pd.direkteavkastning : null,
      rangePosisjon: harData ? beregnRangePosisjon(pd.pris, pd.femtitoUkeLav, pd.femtitoUkeHoy) : null,
    }
  })
}

const MARKED_NAVN = { no: 'Norge', us: 'USA', asia: 'Asia' }
export function marketNavn(marked) { return MARKED_NAVN[marked] || marked }

function sorterVerdi(rad, kolonne) {
  if (kolonne === 'navn') return rad.navn?.toLowerCase() || ''
  return rad[kolonne]
}

export function filtrerOgSorter(rader, { marked, sektor, utbytte, sok, sortKolonne = 'navn', sortRetning = 'asc' } = {}) {
  let ut = rader
  if (marked && marked !== 'alle') ut = ut.filter((r) => r.marked === marked)
  if (sektor && sektor !== 'alle') ut = ut.filter((r) => r.sektor === sektor)
  if (sok && sok.trim()) {
    const q = sok.trim().toLowerCase()
    ut = ut.filter((r) => r.navn.toLowerCase().includes(q) || r.ticker.toLowerCase().includes(q))
  }
  // Rader uten hentet data (harData:false) holdes utenfor et aktivt utbytte-filter —
  // vi vet ikke ennå om de betaler utbytte, så det ville vært en gjetning å plassere
  // dem i noen av gruppene.
  if (utbytte === 'med') ut = ut.filter((r) => r.harData && r.direkteavkastning > 0)
  if (utbytte === 'uten') ut = ut.filter((r) => r.harData && !(r.direkteavkastning > 0))

  const retning = sortRetning === 'desc' ? -1 : 1
  return [...ut].sort((a, b) => {
    const va = sorterVerdi(a, sortKolonne)
    const vb = sorterVerdi(b, sortKolonne)
    if (va == null && vb == null) return 0
    if (va == null) return 1 // manglende data sist, uansett sorteringsretning
    if (vb == null) return -1
    if (va < vb) return -1 * retning
    if (va > vb) return 1 * retning
    return 0
  })
}

// Grupperer (allerede filtrerte/sorterte) rader etter sektor, i en fast rekkefølge —
// stabil uansett hvilken kolonne radene er sortert på, så seksjonene ikke bytter plass
// når brukeren endrer sortering.
export function grupperEtterSektor(rader, rekkefolge) {
  return rekkefolge
    .map((sektor) => ({ sektor, rader: rader.filter((r) => r.sektor === sektor) }))
    .filter((g) => g.rader.length > 0)
}

function finnEkstremverdi(rader, felt, sammenlign) {
  const kandidater = rader.filter((r) => r[felt] != null)
  if (kandidater.length === 0) return null
  return kandidater.reduce((beste, r) => (sammenlign(r[felt], beste[felt]) ? r : beste))
}

// Regner ut punkter til en enkel SVG-polyline for kurshistorikk-grafen —
// skalerer prisserien til viewBox-koordinater. Returnerer '' (ingen linje)
// når det ikke finnes nok punkter til å tegne noe meningsfullt.
export function beregnSvgPunkter(serie, bredde, hoyde) {
  if (!serie || serie.length < 2) return ''
  const priser = serie.map((p) => p.pris)
  const lav = Math.min(...priser)
  const hoy = Math.max(...priser)
  const span = hoy - lav || 1
  return serie
    .map((p, i) => {
      const x = (i / (serie.length - 1)) * bredde
      const y = hoyde - ((p.pris - lav) / span) * hoyde
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function beregnHoydepunkter(rader) {
  return {
    vinner: finnEkstremverdi(rader, 'dagEndringPst', (a, b) => a > b),
    taper: finnEkstremverdi(rader, 'dagEndringPst', (a, b) => a < b),
    hoyestAvkastning: finnEkstremverdi(rader, 'direkteavkastning', (a, b) => a > b),
    antall: rader.length,
  }
}
