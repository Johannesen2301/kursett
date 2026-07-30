import { supabase } from './supabase'

export async function hentTraader(romId) {
  const { data, error } = await supabase.rpc('rom_traader', { rom: romId })
  if (error) throw error
  return data || []
}

export async function opprettTraad(megId, romId, tittel) {
  const { data, error } = await supabase
    .from('forum_traader').insert({ rom_id: romId, tittel: tittel.trim(), avsender_id: megId })
    .select().single()
  if (error) throw error
  return data
}

export async function hentInnlegg(traadId) {
  const { data, error } = await supabase.rpc('traad_innlegg', { traad: traadId })
  if (error) throw error
  return data || []
}

export async function sendInnlegg(megId, traadId, tekst) {
  const { data, error } = await supabase
    .from('forum_innlegg').insert({ traad_id: traadId, avsender_id: megId, tekst }).select().single()
  if (error) throw error
  return data
}

export async function slettInnlegg(innleggId) {
  const { error } = await supabase.from('forum_innlegg').delete().eq('id', innleggId)
  if (error) throw error
}

export async function slettTraad(traadId) {
  const { error } = await supabase.from('forum_traader').delete().eq('id', traadId)
  if (error) throw error
}
