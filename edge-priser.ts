// Kursett — Edge Function «priser»
// Henter kurs, utbytte (siste 12 mnd) og valutakurser fra Yahoo Finance.
// Lim inn HELE denne fila i Supabase → Edge Functions → Deploy a new function
// → Via Editor. Kall funksjonen «priser». Trykk Deploy.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function hentYahoo(ticker: string) {
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
  const sisteAar = utbytter.filter((d) => d.dato >= naa - 365 * 24 * 3600)
  const aarligUtbytte = sisteAar.reduce((s, d) => s + (d.belop || 0), 0)
  const direkteavkastning = pris ? (aarligUtbytte / pris) * 100 : null

  return { pris, valuta, aarligUtbytte, direkteavkastning, utbytter }
}

async function hentFX() {
  const par: Record<string, string> = { EUR: 'EURNOK=X', USD: 'USDNOK=X', SEK: 'SEKNOK=X', DKK: 'DKKNOK=X' }
  const fx: Record<string, number> = { NOK: 1 }
  await Promise.all(
    Object.entries(par).map(async ([k, t]) => {
      try {
        const d = await hentYahoo(t)
        if (d.pris) fx[k] = d.pris
      } catch (_e) { /* hopp over hvis FX feiler */ }
    })
  )
  return fx
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { tickers } = await req.json()
    const liste: string[] = Array.isArray(tickers) ? tickers : []

    const [fx, ...resultater] = await Promise.all([
      hentFX(),
      ...liste.map(async (t) => {
        try { return [t, await hentYahoo(t)] as const }
        catch (e) { return [t, { feil: String(e) }] as const }
      }),
    ])

    const priser: Record<string, unknown> = {}
    for (const [t, data] of resultater) priser[t] = data

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
