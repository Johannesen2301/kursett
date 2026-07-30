import { supabase } from './supabase'

// ---------- Blokkering ----------
export async function blokker(megId, brukerId) {
  const { error } = await supabase
    .from('blokkeringer')
    .insert({ blokkerer_id: megId, blokkert_id: brukerId })
  if (error && !String(error.message).includes('duplicate')) throw error
}

export async function opphevBlokkering(megId, brukerId) {
  const { error } = await supabase
    .from('blokkeringer').delete()
    .eq('blokkerer_id', megId).eq('blokkert_id', brukerId)
  if (error) throw error
}

export async function hentBlokkerte() {
  const { data, error } = await supabase.rpc('mine_blokkeringer')
  if (error) throw error
  return data || []
}

export async function erBlokkert(megId, brukerId) {
  const { data } = await supabase
    .from('blokkeringer').select('blokkert_id')
    .eq('blokkerer_id', megId).eq('blokkert_id', brukerId).maybeSingle()
  return !!data
}

// ---------- Rapportering ----------
export const RAPPORT_GRUNNER = [
  'Spam eller reklame',
  'Trakassering eller hets',
  'Svindel eller villedende innhold',
  'Betalte kjøps-/salgssignaler',
  'Annet',
]

export async function rapporter(megId, { meldtBrukerId, type, innholdId, innholdTekst, begrunnelse }) {
  const { error } = await supabase.from('rapporter').insert({
    melder_id: megId,
    meldt_bruker_id: meldtBrukerId || null,
    type,
    innhold_id: innholdId || null,
    innhold_tekst: innholdTekst || null,
    begrunnelse,
  })
  if (error) throw error
}

// ---------- Slett konto (GDPR) ----------
export async function slettMinKonto() {
  const { error } = await supabase.rpc('slett_min_konto')
  if (error) throw error
  await supabase.auth.signOut()
}
