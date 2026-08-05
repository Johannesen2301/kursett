// Kursett — Edge Function «aksje-historikk»
// Henter en kurshistorikk (siste 6 måneder, daglige sluttkurser) for én ticker,
// til grafen på aksje-detaljsiden. Lim inn HELE denne fila i Supabase →
// Edge Functions → Deploy a new function → Via Editor. Kall funksjonen
// «aksje-historikk». Trykk Deploy.
//
// Egen, liten cache-tabell fra bors_cache: denne lagrer en hel tidsserie, ikke
// ett øyeblikksbilde, og hentes kun én ticker av gangen (lav last).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_MINUTTER = 60

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function hentFraYahoo(ticker: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&range=6mo`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Yahoo svarte ${res.status}`)
  const json = await res.json()
  const r = json?.chart?.result?.[0]
  if (!r) throw new Error('Ingen data fra Yahoo')

  const tidsstempler: number[] = r.timestamp ?? []
  const closer: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const serie = tidsstempler
    .map((dato, i) => ({ dato, pris: closer[i] }))
    .filter((p) => p.pris != null)

  return serie
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { ticker } = await req.json()
    if (!ticker || typeof ticker !== 'string') throw new Error('Mangler ticker')

    const grense = new Date(Date.now() - CACHE_MINUTTER * 60 * 1000).toISOString()
    const { data: fersk } = await supabase
      .from('aksje_historikk_cache').select('*').eq('ticker', ticker).gte('oppdatert', grense).maybeSingle()

    if (fersk) {
      return new Response(JSON.stringify({ serie: fersk.serie ?? [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    try {
      const serie = await hentFraYahoo(ticker)
      await supabase.from('aksje_historikk_cache').upsert({ ticker, serie, oppdatert: new Date().toISOString() })
      return new Response(JSON.stringify({ serie }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      const { data: gammel } = await supabase.from('aksje_historikk_cache').select('*').eq('ticker', ticker).maybeSingle()
      if (gammel?.serie) {
        return new Response(JSON.stringify({ serie: gammel.serie, gammel: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      throw e
    }
  } catch (e) {
    return new Response(JSON.stringify({ feil: String(e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
