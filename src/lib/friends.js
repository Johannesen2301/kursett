import { supabase } from './supabase'
import { hentProfilPaaBrukernavn } from './social'

// ---------- Venner og forespørsler ----------
export async function hentVenner() {
  const { data, error } = await supabase.rpc('mine_venner')
  if (error) throw error
  return data || []
}
export async function hentInnkommende() {
  const { data, error } = await supabase.rpc('innkommende_foresporsler')
  if (error) throw error
  return data || []
}
export async function hentUtgaaende() {
  const { data, error } = await supabase.rpc('utgaaende_foresporsler')
  if (error) throw error
  return data || []
}

export async function sendVenneforesporsel(megId, brukernavn) {
  const profil = await hentProfilPaaBrukernavn(brukernavn.trim())
  if (!profil) throw new Error('Fant ingen investor med brukernavnet «' + brukernavn.trim() + '».')
  if (profil.id === megId) throw new Error('Du kan ikke legge til deg selv.')

  // Finnes det allerede en relasjon (begge retninger)?
  const { data: eksisterende } = await supabase
    .from('vennskap').select('id,status,avsender_id')
    .or(`and(avsender_id.eq.${megId},mottaker_id.eq.${profil.id}),and(avsender_id.eq.${profil.id},mottaker_id.eq.${megId})`)
    .maybeSingle()
  if (eksisterende) {
    if (eksisterende.status === 'godtatt') throw new Error('Dere er allerede venner.')
    if (eksisterende.avsender_id === megId) throw new Error('Du har allerede sendt denne personen en forespørsel.')
    throw new Error('Denne personen har allerede sendt deg en forespørsel — godta den under «Forespørsler».')
  }

  const { error } = await supabase.from('vennskap').insert({ avsender_id: megId, mottaker_id: profil.id })
  if (error) throw error
  return profil.brukernavn
}

export async function godtaForesporsel(vennskapId) {
  const { error } = await supabase.from('vennskap').update({ status: 'godtatt' }).eq('id', vennskapId)
  if (error) throw error
}
export async function avslaEllerFjern(vennskapId) {
  const { error } = await supabase.from('vennskap').delete().eq('id', vennskapId)
  if (error) throw error
}

// ---------- Meldinger ----------
export async function hentMeldinger(megId, vennId) {
  const { data, error } = await supabase
    .from('meldinger').select('*')
    .or(`and(avsender_id.eq.${megId},mottaker_id.eq.${vennId}),and(avsender_id.eq.${vennId},mottaker_id.eq.${megId})`)
    .order('opprettet', { ascending: true })
  if (error) throw error
  return data || []
}

export async function sendMelding(megId, mottakerId, tekst) {
  const { data, error } = await supabase
    .from('meldinger').insert({ avsender_id: megId, mottaker_id: mottakerId, tekst }).select().single()
  if (error) throw error
  return data
}

// Realtime: kaller onNy når noen sender MEG en melding. Returnerer opprydding.
export function abonnerPaaMeldinger(megId, onNy) {
  const kanal = supabase
    .channel('dm-innkommende-' + megId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meldinger', filter: `mottaker_id=eq.${megId}` },
      (payload) => onNy(payload.new)
    )
    .subscribe()
  return () => { supabase.removeChannel(kanal) }
}

// Slett egen direktemelding
export async function slettMelding(meldingId) {
  const { error } = await supabase.from('meldinger').delete().eq('id', meldingId)
  if (error) throw error
}
