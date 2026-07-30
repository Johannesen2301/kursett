import { supabase } from './supabase'
import { finnTicker } from './tickers'
export async function hentPriser(posisjoner){
  const tickers=[...new Set(posisjoner.map(p=>p.ticker||finnTicker(p.navn)).filter(Boolean))]
  if(tickers.length===0) return { priser:{}, fx:{NOK:1} }
  const { data, error }=await supabase.functions.invoke('priser',{ body:{ tickers } })
  if(error) throw error
  if(data?.feil) throw new Error(data.feil)
  return data
}
