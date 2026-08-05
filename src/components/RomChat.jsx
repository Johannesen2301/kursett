import { useEffect, useMemo, useRef, useState } from 'react'
import RapporterDialog from './RapporterDialog'

const init = (n) => (n || '?').slice(0, 2).toUpperCase()
const klokke = (ts) => new Date(ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })

function nevnerBruker(tekst, navn) {
  if (!navn) return false
  const escaped = navn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|\\s)@' + escaped + '(\\s|$)', 'i').test(tekst)
}

function meldingsdeler(tekst, medlemNavnSet) {
  return tekst.split(/(@[\p{L}\p{N}_]+)/gu).map((del, i) => {
    if (del.startsWith('@') && medlemNavnSet.has(del.slice(1).toLowerCase())) {
      return <span key={i} className="nevnelse-pill">{del}</span>
    }
    return del
  })
}

export default function RomChat({ rom, meldinger, megId, megNavn, medlemmer, onSend, onBlokkert, onSlett, erEier }) {
  const [rapport, setRapport] = useState(null)
  const [tekst, setTekst] = useState('')
  const [sender, setSender] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null) // { start, end, partial } | null
  const enden = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { enden.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  const medlemNavnSet = useMemo(
    () => new Set((medlemmer || []).map((m) => m.brukernavn?.toLowerCase()).filter(Boolean)),
    [medlemmer]
  )

  const forslag = useMemo(() => {
    if (!mentionQuery) return []
    const partial = mentionQuery.partial.toLowerCase()
    return (medlemmer || [])
      .filter((m) => m.bruker_id !== megId && m.brukernavn?.toLowerCase().startsWith(partial))
      .slice(0, 6)
  }, [mentionQuery, medlemmer, megId])

  function handleChange(e) {
    const val = e.target.value
    const cursor = e.target.selectionStart
    setTekst(val)
    const foer = val.slice(0, cursor)
    const m = foer.match(/(^|\s)@([\p{L}\p{N}_]*)$/u)
    if (m) {
      setMentionQuery({ start: cursor - m[2].length - 1, end: cursor, partial: m[2] })
    } else {
      setMentionQuery(null)
    }
  }

  function velgForslag(navn) {
    if (!mentionQuery) return
    const nyTekst = tekst.slice(0, mentionQuery.start) + '@' + navn + ' ' + tekst.slice(mentionQuery.end)
    setTekst(nyTekst)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  async function submit(e) {
    e.preventDefault()
    const t = tekst.trim()
    if (!t) return
    setSender(true)
    try { await onSend(t); setTekst(''); setMentionQuery(null) } finally { setSender(false) }
  }

  return (
    <div className="forum">
      <div className="dm-body">
        {meldinger.length === 0 ? (
          <div className="dm-tom">Ingen meldinger ennå. Start samtalen 👋</div>
        ) : (
          meldinger.map((m) => (
            <div key={m.id} className={'rom-msg' + (nevnerBruker(m.tekst, megNavn) ? ' nevnt' : '')}>
              <div className="rom-msg-av" style={{ background: m.avatar_farge || '#8893A0' }}>{init(m.brukernavn)}</div>
              <div className="rom-msg-b">
                <div className="rom-msg-topp">
                  <span className="rom-msg-navn">{m.brukernavn}{m.avsender_id === megId ? ' (deg)' : ''}</span>
                  <span className="rom-msg-tid">{klokke(m.opprettet)}</span>
                </div>
                <div className="rom-msg-tekst">{meldingsdeler(m.tekst, medlemNavnSet)}</div>
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
      <form className="dm-input" onSubmit={submit} style={{ position: 'relative' }}>
        {forslag.length > 0 && (
          <div className="mention-forslag">
            {forslag.map((f) => (
              <button type="button" key={f.bruker_id} className="mention-forslag-item"
                onClick={() => velgForslag(f.brukernavn)}>
                <span className="mention-forslag-av" style={{ background: f.avatar_farge || '#8893A0' }}>{init(f.brukernavn)}</span>
                {f.brukernavn}
              </button>
            ))}
          </div>
        )}
        <input ref={inputRef} value={tekst} onChange={handleChange}
          placeholder={'Melding i #' + rom.navn + ' … (bruk @ for å nevne noen)'} />
        <button className="btn" disabled={sender || !tekst.trim()}>Send</button>
      </form>
      {rapport && (
        <RapporterDialog mål={rapport} onLukk={() => setRapport(null)}
          onBlokkert={(id) => { setRapport(null); onBlokkert?.(id) }} />
      )}
    </div>
  )
}
