// Kursett — Edge Function «nyheter»
// Henter nyhetssaker per ticker fra Yahoo Finance sitt søke-endepunkt — samme
// uoffisielle Yahoo-familie appen allerede bruker til kurser (query1.finance.yahoo.com).
// Lim inn HELE denne fila i Supabase → Edge Functions → Deploy a new function
// → Via Editor. Kall funksjonen «nyheter». Trykk Deploy.
//
// Brukes to steder: aksje-detaljsiden (kalt med én ticker) og portefølje-siden
// for nyheter (kalt med hele brukerens tickerliste) — samme funksjon begge veier.
// Svaret er allerede slått sammen, deduplisert (på uuid) og tidssortert, så
// klienten bare viser det den får.
//
// VIKTIG: Yahoo sitt søk gir dårlige treff på tickere med børs-suffiks
// (f.eks. «AKRBP.OL» gir generiske, urelaterte amerikanske nyheter) — verifisert
// direkte. Søker derfor på SELSKAPSNAVNET («Aker BP»), som gir treffsikre
// resultater, og filtrerer i etterkant på at tickeren faktisk finnes i
// artikkelens relatedTickers — luker bort de tangentielle treffene navnesøk
// også kan gi.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_MINUTTER = 30
const BOLK_STORRELSE = 12
const NYHETER_PER_TICKER = 10

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function hentFraYahoo(sokeord: string, ticker: string) {
  // Yahoo tagger nyheter for tverrnoterte selskaper med den bare ADR-stil
  // tickeren (f.eks. «EQNR»), ikke børs-suffikset variant vi bruker internt
  // («EQNR.OL») — verifisert direkte (0/10 Equinor-saker brukte «EQNR.OL»,
  // alle brukte «EQNR»). Match derfor på både full ticker og delen før punktum.
  const grunnTicker = ticker.split('.')[0]
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sokeord)}` +
    `&newsCount=${NYHETER_PER_TICKER}&quotesCount=0`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Yahoo svarte ${res.status}`)
  const json = await res.json()
  const nyheter = json?.news ?? []
  return nyheter
    .map((n: any) => ({
      uuid: n.uuid,
      tittel: n.title,
      kilde: n.publisher,
      lenke: n.link,
      tid: n.providerPublishTime,
      relaterteTickere: n.relatedTickers ?? [],
    }))
    // Navnesøk kan gi treff som bare tangentielt nevner selskapet — behold
    // kun saker der tickeren (eller den bare varianten uten børs-suffiks)
    // faktisk står i relatedTickers.
    .filter((a: any) => a.relaterteTickere.includes(ticker) || a.relaterteTickere.includes(grunnTicker))
}

function bolker<T>(liste: T[], storrelse: number): T[][] {
  const ut: T[][] = []
  for (let i = 0; i < liste.length; i += storrelse) ut.push(liste.slice(i, i + storrelse))
  return ut
}

async function hentMedCache(tickere: string[], navnPerTicker: Record<string, string>) {
  const perTicker: Record<string, any[]> = {}
  if (tickere.length === 0) return perTicker

  const grense = new Date(Date.now() - CACHE_MINUTTER * 60 * 1000).toISOString()

  const { data: ferske } = await supabase
    .from('nyheter_cache')
    .select('*')
    .in('ticker', tickere)
    .gte('oppdatert', grense)

  const iCache = new Set<string>()
  for (const rad of ferske ?? []) {
    iCache.add(rad.ticker)
    perTicker[rad.ticker] = rad.artikler ?? []
  }

  const maaHentes = tickere.filter((t) => !iCache.has(t))
  for (const bolk of bolker(maaHentes, BOLK_STORRELSE)) {
    await Promise.all(
      bolk.map(async (t) => {
        try {
          const sokeord = navnPerTicker[t] || t
          const artikler = await hentFraYahoo(sokeord, t)
          perTicker[t] = artikler
          await supabase.from('nyheter_cache').upsert({ ticker: t, artikler, oppdatert: new Date().toISOString() })
        } catch (e) {
          const { data: gammel } = await supabase.from('nyheter_cache').select('*').eq('ticker', t).maybeSingle()
          perTicker[t] = gammel?.artikler ?? []
        }
      })
    )
  }

  return perTicker
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { tickers, navn } = await req.json()
    const liste: string[] = Array.isArray(tickers) ? tickers : []
    const navnPerTicker: Record<string, string> = navn && typeof navn === 'object' ? navn : {}

    const perTicker = await hentMedCache(liste, navnPerTicker)

    const sett = new Map<string, any>()
    for (const artikler of Object.values(perTicker)) {
      for (const a of artikler as any[]) {
        if (a?.uuid && !sett.has(a.uuid)) sett.set(a.uuid, a)
      }
    }
    const nyheter = [...sett.values()].sort((a, b) => (b.tid ?? 0) - (a.tid ?? 0))

    return new Response(JSON.stringify({ nyheter }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ feil: String(e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
