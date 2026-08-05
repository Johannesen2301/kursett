// Kursett — Edge Function «bors»
// Henter kurs, dagsendring, 52-ukers høy/lav og utbytte for Børs-screeneren.
// Lim inn HELE denne fila i Supabase → Edge Functions → Deploy a new function
// → Via Editor. Kall funksjonen «bors». Trykk Deploy.
//
// Egen funksjon fra «priser» (porteføljesidens): denne siden er offentlig og
// innloggingsfri, så den kan få mye mer trafikk fra mange flere samtidige
// besøkende enn porteføljesiden. Cachen er derfor lengre (60 min mot 15 min),
// og kalde tickere hentes i små bolker i stedet for én stor samtidig sverm mot
// Yahoo — for å holde oss høflige mot en uoffisiell kilde som kan blokkere oss.
//
// Viser priser i selskapets egen valuta (ingen NOK-omregning) — screeneren er
// ren markedsdata på tvers av børser, ikke en porteføljeverdi.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_MINUTTER = 60
const BOLK_STORRELSE = 12

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function hentFraYahoo(ticker: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&range=1y&events=div`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Yahoo svarte ${res.status}`)
  const json = await res.json()
  const r = json?.chart?.result?.[0]
  if (!r) throw new Error('Ingen data fra Yahoo')

  const meta = r.meta ?? {}
  const pris = meta.regularMarketPrice ?? null
  const valuta = meta.currency ?? null
  const femtitoUkeHoy = meta.fiftyTwoWeekHigh ?? null
  const femtitoUkeLav = meta.fiftyTwoWeekLow ?? null

  // meta.chartPreviousClose er sluttkursen for ~1 år siden (starten av «range»),
  // IKKE gårsdagens sluttkurs — ubrukelig til dagsendring. Bruker i stedet de to
  // siste ikke-null sluttkursene fra tidsserien.
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const siste = closes.filter((c) => c != null) as number[]
  let dagEndringPst: number | null = null
  if (siste.length >= 2) {
    const naaVerdi = siste[siste.length - 1]
    const forrige = siste[siste.length - 2]
    if (forrige) dagEndringPst = ((naaVerdi - forrige) / forrige) * 100
  }

  const divObj = r.events?.dividends ?? {}
  const utbytter = Object.values(divObj).map((d: any) => ({ dato: d.date, belop: d.amount }))
  const naa = Date.now() / 1000
  const sisteAar = utbytter.filter((d: any) => d.dato >= naa - 365 * 24 * 3600)
  const aarligUtbytte = sisteAar.reduce((s: number, d: any) => s + (d.belop || 0), 0)
  const direkteavkastning = pris ? (aarligUtbytte / pris) * 100 : null

  return { pris, valuta, dagEndringPst, femtitoUkeHoy, femtitoUkeLav, aarligUtbytte, direkteavkastning }
}

function bolker<T>(liste: T[], storrelse: number): T[][] {
  const ut: T[][] = []
  for (let i = 0; i < liste.length; i += storrelse) ut.push(liste.slice(i, i + storrelse))
  return ut
}

async function hentMedCache(tickere: string[]) {
  const resultat: Record<string, unknown> = {}
  if (tickere.length === 0) return resultat

  const grense = new Date(Date.now() - CACHE_MINUTTER * 60 * 1000).toISOString()

  const { data: ferske } = await supabase
    .from('bors_cache')
    .select('*')
    .in('ticker', tickere)
    .gte('oppdatert', grense)

  const iCache = new Set<string>()
  for (const rad of ferske ?? []) {
    iCache.add(rad.ticker)
    resultat[rad.ticker] = {
      pris: rad.pris,
      valuta: rad.valuta,
      dagEndringPst: rad.dag_endring_pst,
      femtitoUkeHoy: rad.femtito_uke_hoy,
      femtitoUkeLav: rad.femtito_uke_lav,
      aarligUtbytte: rad.aarlig_utbytte,
      direkteavkastning: rad.direkteavkastning,
      fraCache: true,
    }
  }

  const maaHentes = tickere.filter((t) => !iCache.has(t))
  for (const bolk of bolker(maaHentes, BOLK_STORRELSE)) {
    await Promise.all(
      bolk.map(async (t) => {
        try {
          const d = await hentFraYahoo(t)
          resultat[t] = d
          await supabase.from('bors_cache').upsert({
            ticker: t,
            pris: d.pris,
            valuta: d.valuta,
            dag_endring_pst: d.dagEndringPst,
            femtito_uke_hoy: d.femtitoUkeHoy,
            femtito_uke_lav: d.femtitoUkeLav,
            aarlig_utbytte: d.aarligUtbytte,
            direkteavkastning: d.direkteavkastning,
            oppdatert: new Date().toISOString(),
          })
        } catch (e) {
          // Yahoo feilet — prøv en gammel cache-verdi som nødløsning
          const { data: gammel } = await supabase
            .from('bors_cache').select('*').eq('ticker', t).maybeSingle()
          if (gammel?.pris) {
            resultat[t] = {
              pris: gammel.pris,
              valuta: gammel.valuta,
              dagEndringPst: gammel.dag_endring_pst,
              femtitoUkeHoy: gammel.femtito_uke_hoy,
              femtitoUkeLav: gammel.femtito_uke_lav,
              aarligUtbytte: gammel.aarlig_utbytte,
              direkteavkastning: gammel.direkteavkastning,
              fraCache: true,
              gammel: true,
            }
          } else {
            resultat[t] = { feil: String(e) }
          }
        }
      })
    )
  }

  return resultat
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { tickers } = await req.json()
    const liste: string[] = Array.isArray(tickers) ? tickers : []

    const priser = await hentMedCache(liste)

    return new Response(JSON.stringify({ priser }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ feil: String(e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
