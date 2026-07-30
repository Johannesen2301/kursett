import { useEffect, useRef, useState } from 'react'
import RapporterDialog from './RapporterDialog'

const init = (n) => (n || '?').slice(0, 2).toUpperCase()
const klokke = (ts) => new Date(ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })

export default function RomChat({ rom, meldinger, megId, onSend, onBlokkert, onSlett, erEier }) {
  const [rapport, setRapport] = useState(null)
  const [tekst, setTekst] = useState('')
  const [sender, setSender] = useState(false)
  const enden = useRef(null)

  useEffect(() => { enden.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  async function submit(e) {
    e.preventDefault()
    const t = tekst.trim()
    if (!t) return
    setSender(true)
    try { await onSend(t); setTekst('') } finally { setSender(false) }
  }

  return (
    <div className="forum">
      <div className="dm-body">
        {meldinger.length === 0 ? (
          <div className="dm-tom">Ingen meldinger ennå. Start samtalen 👋</div>
        ) : (
          meldinger.map((m) => (
            <div key={m.id} className="rom-msg">
              <div className="rom-msg-av" style={{ background: m.avatar_farge || '#8893A0' }}>{init(m.brukernavn)}</div>
              <div className="rom-msg-b">
                <div className="rom-msg-topp">
                  <span className="rom-msg-navn">{m.brukernavn}{m.avsender_id === megId ? ' (deg)' : ''}</span>
                  <span className="rom-msg-tid">{klokke(m.opprettet)}</span>
                </div>
                <div className="rom-msg-tekst">{m.tekst}</div>
              </div>
              <div className="msg-verktoy">
                {m.avsender_id !== megId && (
                  <button className="mod-flagg" title="Rapporter"
                    onClick={() => setRapport({ type: 'rom', brukerId: m.avsender_id, navn: m.brukernavn, innholdId: m.id, tekst: m.tekst })}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></svg>
                  </button>
                )}
                {(m.avsender_id === megId || erEier) && (
                  <button className="mod-flagg" title={m.avsender_id === megId ? 'Slett meldingen din' : 'Slett (du eier rommet)'}
                    onClick={() => { if (confirm('Slette denne meldingen?')) onSlett?.(m.id) }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={enden} />
      </div>
      <form className="dm-input" onSubmit={submit}>
        <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder={'Melding i #' + rom.navn + ' …'} />
        <button className="btn" disabled={sender || !tekst.trim()}>Send</button>
      </form>
      {rapport && (
        <RapporterDialog mål={rapport} onLukk={() => setRapport(null)}
          onBlokkert={(id) => { setRapport(null); onBlokkert?.(id) }} />
      )}
    </div>
  )
}
