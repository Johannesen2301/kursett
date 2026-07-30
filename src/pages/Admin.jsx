import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const dato = (ts) => new Date(ts).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Admin() {
  const [rapporter, setRapporter] = useState([])
  const [laster, setLaster] = useState(true)
  const [ikkeAdmin, setIkkeAdmin] = useState(false)
  const [tall, setTall] = useState(null)

  async function last() {
    setLaster(true)
    try {
      const { data: adm } = await supabase.rpc('er_admin')
      if (!adm) { setIkkeAdmin(true); setLaster(false); return }

      const { data } = await supabase.rpc('admin_rapporter')
      setRapporter(data || [])

      // Enkel statistikk
      const [{ count: profiler }, { count: rom }, { count: meldinger }] = await Promise.all([
        supabase.from('profiler').select('*', { count: 'exact', head: true }),
        supabase.from('rom').select('*', { count: 'exact', head: true }),
        supabase.from('rom_meldinger').select('*', { count: 'exact', head: true }),
      ])
      setTall({ profiler, rom, meldinger })
    } catch {
      setIkkeAdmin(true)
    } finally {
      setLaster(false)
    }
  }
  useEffect(() => { last() }, [])

  if (laster) return <div className="page"><div className="muted-note">Laster …</div></div>

  if (ikkeAdmin) {
    return (
      <div className="page">
        <div className="page-head"><h1>Ikke tilgang</h1></div>
        <div className="muted-note">Denne siden er kun for administrator.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Admin</h1>
        <p className="page-sub">Rapporter og oversikt</p>
      </div>

      {tall && (
        <div className="metrics">
          <div className="metric"><div className="k">Profiler</div><div className="v">{tall.profiler ?? 0}</div></div>
          <div className="metric"><div className="k">Rom</div><div className="v">{tall.rom ?? 0}</div></div>
          <div className="metric"><div className="k">Rom-meldinger</div><div className="v">{tall.meldinger ?? 0}</div></div>
          <div className="metric"><div className="k">Rapporter</div><div className={'v ' + (rapporter.length > 0 ? 'down' : '')}>{rapporter.length}</div></div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><h2>Rapporter</h2><span className="hint">Nyeste først</span></div>
        {rapporter.length === 0 ? (
          <div className="muted-note">Ingen rapporter. 🌱</div>
        ) : (
          rapporter.map((r) => (
            <div key={r.id} className="rapport-rad">
              <div className="rapport-topp">
                <span className="rapport-grunn">{r.begrunnelse}</span>
                <span className="rapport-tid">{dato(r.opprettet)}</span>
              </div>
              <div className="rapport-meta">
                <b>{r.melder}</b> rapporterte <b>{r.meldt}</b> · {r.type}
              </div>
              {r.innhold_tekst && <div className="rapport-sitat">«{r.innhold_tekst}»</div>}
            </div>
          ))
        )}
      </div>

      <div className="boundary-note">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        Trenger du å slette noe, gjør det direkte i rommet — du kan slette hvilken som helst melding som admin.
      </div>
    </div>
  )
}
