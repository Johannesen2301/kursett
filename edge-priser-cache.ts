// Kursett — Edge Function «priser» (MED CACHE)
// Lim inn HELE denne i Supabase → Edge Functions → priser → filen index.ts → Deploy.
//
// Hva som er nytt: funksjonen sjekker først kurs_cache-tabellen. Er kursen
// under 15 minutter gammel, brukes den lagrede verdien. Kun ferske/manglende
// tickere hentes fra Yahoo. Det betyr ett Yahoo-kall per ticker per kvarter,
// uansett hvor mange brukere som laster porteføljen sin.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_MINUTTER = 15
const FX_TICKERE: Record<string, string> = {
  EUR: 'EURNOK=X', USD: 'USDNOK=X', SEK: 'SEKNOK=X', DKK: 'DKKNOK=X',
}

// Supabase-klient med service_role — går forbi RLS, kun tilgjengelig server-side.
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

  const pris = r.meta?.regularMarketPrice ?? null
  const valuta = r.meta?.currency ?? 'NOK'

  const divObj = r.events?.dividends ?? {}
  const utbytter = Object.values(divObj).map((d: any) => ({ dato: d.date, belop: d.amount }))
  const naa = Date.now() / 1000
  const sisteAar = utbytter.filter((d: any) => d.dato >= naa - 365 * 24 * 3600)
  const aarligUtbytte = sisteAar.reduce((s: number, d: any) => s + (d.belop || 0), 0)
  const direkteavkastning = pris ? (aarligUtbytte / pris) * 100 : null

  return { pris, valuta, aarligUtbytte, direkteavkastning, utbytter }
}

// Henter tickere: bruker cache der den er fersk, Yahoo der den ikke er.
async function hentMedCache(tickere: string[]) {
  const resultat: Record<string, unknown> = {}
  if (tickere.length === 0) return resultat

  const grense = new Date(Date.now() - CACHE_MINUTTER * 60 * 1000).toISOString()

  // 1) Hva ligger ferskt i cachen?
  const { data: ferske } = await supabase
    .from('kurs_cache')
    .select('*')
    .in('ticker', tickere)
    .gte('oppdatert', grense)

  const iCache = new Set<string>()
  for (const rad of ferske ?? []) {
    iCache.add(rad.ticker)
    resultat[rad.ticker] = {
      pris: rad.pris,
      valuta: rad.valuta,
      aarligUtbytte: rad.aarlig_utbytte,
      direkteavkastning: rad.direkteavkastning,
      utbytter: rad.utbytter ?? [],
      fraCache: true,
    }
  }

  // 2) Resten hentes fra Yahoo og lagres
  const maaHentes = tickere.filter((t) => !iCache.has(t))
  await Promise.all(
    maaHentes.map(async (t) => {
      try {
        const d = await hentFraYahoo(t)
        resultat[t] = d
        await supabase.from('kurs_cache').upsert({
          ticker: t,
          pris: d.pris,
          valuta: d.valuta,
          aarlig_utbytte: d.aarligUtbytte,
          direkteavkastning: d.direkteavkastning,
          utbytter: d.utbytter,
          oppdatert: new Date().toISOString(),
        })
      } catch (e) {
        // Yahoo feilet — prøv en gammel cache-verdi som nødløsning
        const { data: gammel } = await supabase
          .from('kurs_cache').select('*').eq('ticker', t).maybeSingle()
        if (gammel?.pris) {
          resultat[t] = {
            pris: gammel.pris,
            valuta: gammel.valuta,
            aarligUtbytte: gammel.aarlig_utbytte,
            direkteavkastning: gammel.direkteavkastning,
            utbytter: gammel.utbytter ?? [],
            fraCache: true,
            gammel: true,
          }
        } else {
          resultat[t] = { feil: String(e) }
        }
      }
    })
  )

  return resultat
}

async function hentFX() {
  const fxTickere = Object.values(FX_TICKERE)
  const data = await hentMedCache(fxTickere)
  const fx: Record<string, number> = { NOK: 1 }
  for (const [valuta, ticker] of Object.entries(FX_TICKERE)) {
    const d = data[ticker] as any
    if (d?.pris) fx[valuta] = d.pris
  }
  return fx
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { tickers } = await req.json()
    const liste: string[] = Array.isArray(tickers) ? tickers : []

    const [priser, fx] = await Promise.all([hentMedCache(liste), hentFX()])

    return new Response(JSON.stringify({ priser, fx }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ feil: String(e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
