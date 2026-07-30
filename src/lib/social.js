import { supabase } from './supabase'

// ---------- Profiler ----------
export async function hentEgenProfil(userId) {
  const { data } = await supabase.from('profiler').select('*').eq('id', userId).maybeSingle()
  return data
}

export async function hentProfilPaaBrukernavn(brukernavn) {
  const { data } = await supabase.from('profiler').select('*').eq('brukernavn', brukernavn).maybeSingle()
  return data
}

export async function lagreProfil(userId, { brukernavn, bio, avatar_farge, vis_beholdninger }) {
  const { error } = await supabase
    .from('profiler')
    .upsert({ id: userId, brukernavn, bio, avatar_farge, vis_beholdninger })
  if (error) throw error
}

// ---------- Offentlig sammensetning (kun %) ----------
export async function hentOffentligSammensetning(brukerId) {
  const { data, error } = await supabase.rpc('offentlig_sammensetning', { bruker: brukerId })
  if (error) throw error
  return data || []
}

export async function hentOffentligeBeholdninger(brukerId) {
  const { data, error } = await supabase.rpc('offentlige_beholdninger', { bruker: brukerId })
  if (error) throw error
  return data || []
}

// ---------- Toppliste ----------
export async function hentToppliste() {
  const { data, error } = await supabase.rpc('toppliste')
  if (error) throw error
  return data || []
}

// ---------- Følg ----------
export async function folgerTall(brukerId) {
  const { count: folgere } = await supabase
    .from('folger').select('*', { count: 'exact', head: true }).eq('fulgt_id', brukerId)
  const { count: folger } = await supabase
    .from('folger').select('*', { count: 'exact', head: true }).eq('folger_id', brukerId)
  return { folgere: folgere || 0, folger: folger || 0 }
}

export async function sjekkOmFolger(megId, brukerId) {
  const { data } = await supabase
    .from('folger').select('folger_id')
    .eq('folger_id', megId).eq('fulgt_id', brukerId).maybeSingle()
  return !!data
}

export async function folg(megId, brukerId) {
  const { error } = await supabase.from('folger').insert({ folger_id: megId, fulgt_id: brukerId })
  if (error) throw error
}

export async function sluttAaFolge(megId, brukerId) {
  const { error } = await supabase.from('folger').delete()
    .eq('folger_id', megId).eq('fulgt_id', brukerId)
  if (error) throw error
}
