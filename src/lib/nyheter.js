import { supabase } from './supabase'

// `navnPerTicker` (ticker → selskapsnavn) brukes av edge-funksjonen som søkeord
// mot Yahoo — søk på ticker med børs-suffiks (f.eks. «AKRBP.OL») gir dårlige,
// urelaterte treff, mens selskapsnavn («Aker BP») gir treffsikre resultater.
export async function hentNyheter(tickers, navnPerTicker = {}) {
  if (!tickers?.length) return { nyheter: [] }
  const { data, error } = await supabase.functions.invoke('nyheter', { body: { tickers, navn: navnPerTicker } })
  if (error) throw error
  if (data?.feil) throw new Error(data.feil)
  return data
}

const MINUTT = 60
const TIME = 60 * MINUTT
const DAG = 24 * TIME

// Relativ tid på norsk, til visning under en nyhetssak. `tid` er unix-sekunder
// (samme enhet som Yahoo sitt providerPublishTime), `naa` kan overstyres i tester.
export function tidSiden(tid, naa = Date.now() / 1000) {
  if (tid == null) return ''
  const diff = Math.max(0, naa - tid)
  if (diff < MINUTT) return 'akkurat nå'
  if (diff < TIME) return `${Math.floor(diff / MINUTT)} min siden`
  if (diff < DAG) return `${Math.floor(diff / TIME)} t siden`
  const dager = Math.floor(diff / DAG)
  if (dager < 14) return `${dager} d siden`
  return new Date(tid * 1000).toLocaleDateString('nb-NO')
}

// Merker hver nyhetssak med hvilket av brukerens selskaper den gjelder (for
// visning av en «gjelder: Equinor»-tag i portefølje-nyhetene). `tickerTilNavn`
// er et Map/objekt fra ticker til visningsnavn.
export function merkMedSelskap(nyheter, tickerTilNavn) {
  return nyheter.map((n) => {
    const navn = (n.relaterteTickere || [])
      .map((t) => tickerTilNavn[t])
      .filter(Boolean)
    return { ...n, gjelderNavn: navn }
  })
}
