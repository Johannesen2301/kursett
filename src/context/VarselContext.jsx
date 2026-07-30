import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const VarselContext = createContext({ dm: 0, rom: 0, foresporsler: 0, refresh: () => {} })

export function VarselProvider({ children }) {
  const { user } = useAuth()
  const [tall, setTall] = useState({ dm: 0, rom: 0, foresporsler: 0 })
  const [perVenn, setPerVenn] = useState({})
  const [perRom, setPerRom] = useState({})

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const [{ data: v }, { data: dm }, { data: rom }] = await Promise.all([
        supabase.rpc('varsler'),
        supabase.rpc('uleste_dm'),
        supabase.rpc('uleste_rom'),
      ])
      if (v && v[0]) {
        setTall({
          dm: Number(v[0].dm) || 0,
          rom: Number(v[0].rom) || 0,
          foresporsler: Number(v[0].foresporsler) || 0,
        })
      }
      const dmMap = {}
      ;(dm || []).forEach((r) => { dmMap[r.venn_id] = Number(r.antall) })
      setPerVenn(dmMap)

      const romMap = {}
      ;(rom || []).forEach((r) => { romMap[r.rom_id] = Number(r.antall) })
      setPerRom(romMap)
    } catch { /* stille — varsler er ikke kritisk */ }
  }, [user])

  useEffect(() => {
    if (!user) return
    refresh()

    // Oppdater når det kommer nye meldinger
    const kanal = supabase
      .channel('varsler-' + user.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meldinger', filter: `mottaker_id=eq.${user.id}` },
        () => refresh())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rom_meldinger' },
        () => refresh())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vennskap', filter: `mottaker_id=eq.${user.id}` },
        () => refresh())
      .subscribe()

    // Sikkerhetsnett: oppdater hvert minutt
    const t = setInterval(refresh, 60000)

    return () => { supabase.removeChannel(kanal); clearInterval(t) }
  }, [user, refresh])

  return (
    <VarselContext.Provider value={{ ...tall, perVenn, perRom, refresh }}>
      {children}
    </VarselContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useVarsler = () => useContext(VarselContext)

// Marker en samtale som lest
export async function markerLest(type, refId) {
  try { await supabase.rpc('marker_lest', { p_type: type, p_ref: refId }) } catch { /* ignorer */ }
}
