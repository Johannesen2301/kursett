import { supabase } from './supabase'

export async function oppdagRom() {
  const { data, error } = await supabase.rpc('oppdag_rom')
  if (error) throw error
  return data || []
}

export async function opprettRom(megId, navn, beskrivelse) {
  const { data, error } = await supabase
    .from('rom').insert({ navn: navn.trim(), beskrivelse: beskrivelse.trim() || null, eier_id: megId })
    .select().single()
  if (error) throw error
  // Eier blir automatisk medlem
  const { error: mErr } = await supabase.from('rom_medlemmer').insert({ rom_id: data.id, bruker_id: megId })
  if (mErr) throw mErr
  return data
}

export async function bliMedlem(megId, romId) {
  const { error } = await supabase.from('rom_medlemmer').insert({ rom_id: romId, bruker_id: megId })
  if (error) throw error
}

export async function forlatRom(megId, romId) {
  const { error } = await supabase.from('rom_medlemmer').delete().eq('rom_id', romId).eq('bruker_id', megId)
  if (error) throw error
}

export async function hentRomMeldinger(romId) {
  const { data, error } = await supabase.rpc('rom_meldinger_med_navn', { rom: romId })
  if (error) throw error
  return data || []
}

export async function hentRomMedlemmer(romId) {
  const { data, error } = await supabase.rpc('rom_medlemmer_med_navn', { rom: romId })
  if (error) throw error
  return data || []
}

export async function sendRomMelding(megId, romId, tekst) {
  const { data, error } = await supabase
    .from('rom_meldinger').insert({ rom_id: romId, avsender_id: megId, tekst }).select().single()
  if (error) throw error
  return data
}

// Realtime: nye meldinger i et rom. Returnerer opprydding.
export function abonnerPaaRom(romId, onNy) {
  const kanal = supabase
    .channel('rom-' + romId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'rom_meldinger', filter: `rom_id=eq.${romId}` },
      (payload) => onNy(payload.new)
    )
    .subscribe()
  return () => { supabase.removeChannel(kanal) }
}

// Slett melding i rom (egen, eller hvilken som helst hvis du eier rommet)
export async function slettRomMelding(meldingId) {
  const { error } = await supabase.from('rom_meldinger').delete().eq('id', meldingId)
  if (error) throw error
}

// Slett rom (kun eier — håndhevet i databasen).
// Cascade sletter medlemskap, meldinger, forumtråder og innlegg.
export async function slettRom(romId) {
  const { error } = await supabase.from('rom').delete().eq('id', romId)
  if (error) throw error
}
