import { useEffect, useRef, useState } from 'react'
import RapporterDialog from './RapporterDialog'

export default function DMChat({ venn, meldinger, megId, onSend, onBlokkert, onSlett }) {
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

  const initial = (venn.brukernavn || '?').slice(0, 2).toUpperCase()

  return (
    <div className="dm">
      <div className="dm-head">
        <div className="dm-av" style={{ background: venn.avatar_farge || '#12868C' }}>{initial}</div>
        <div className="dm-navn">{venn.brukernavn}</div>
        <button className="mod-flagg dm-flagg" title="Rapporter eller blokker"
          onClick={() => setRapport({ type: 'dm', brukerId: venn.venn_id, navn: venn.brukernavn })}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></svg>
        </button>
      </div>
      <div className="dm-body">
        {meldinger.length === 0 ? (
          <div className="dm-tom">Ingen meldinger ennå. Si hei 👋</div>
        ) : (
          meldinger.map((m) => (
            <div key={m.id} className={'dm-msg' + (m.avsender_id === megId ? ' egen' : '')}>
              {m.avsender_id === megId && (
                <button className="msg-slett" title="Slett melding"
                  onClick={() => { if (confirm('Slette denne meldingen?')) onSlett?.(m.id) }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              )}
              <div className="dm-boble">{m.tekst}</div>
            </div>
          ))
        )}
        <div ref={enden} />
      </div>
      <form className="dm-input" onSubmit={submit}>
        <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder={'Melding til ' + venn.brukernavn + ' …'} />
        <button className="btn" disabled={sender || !tekst.trim()}>Send</button>
      </form>
      {rapport && (
        <RapporterDialog mål={rapport} onLukk={() => setRapport(null)}
          onBlokkert={(id) => { setRapport(null); onBlokkert?.(id) }} />
      )}
    </div>
  )
}
