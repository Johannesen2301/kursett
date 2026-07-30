import { useEffect, useRef, useState } from 'react'
import { hentTraader, opprettTraad, hentInnlegg, sendInnlegg, slettInnlegg, slettTraad } from '../lib/forum'

const init = (n) => (n || '?').slice(0, 2).toUpperCase()
const dato = (ts) => new Date(ts).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Forum({ rom, megId }) {
  const [traader, setTraader] = useState([])
  const [laster, setLaster] = useState(true)
  const [aktiv, setAktiv] = useState(null) // åpen tråd
  const [innlegg, setInnlegg] = useState([])
  const [visNy, setVisNy] = useState(false)
  const [nyTittel, setNyTittel] = useState('')
  const [svar, setSvar] = useState('')
  const [jobber, setJobber] = useState(false)
  const [feil, setFeil] = useState('')
  const enden = useRef(null)

  async function lastTraader() {
    setLaster(true)
    try { setTraader(await hentTraader(rom.id)) } catch (e) { setFeil(e.message) } finally { setLaster(false) }
  }
  useEffect(() => { lastTraader(); setAktiv(null); setVisNy(false) /* eslint-disable-next-line */ }, [rom.id])
  useEffect(() => { enden.current?.scrollIntoView() }, [innlegg])

  async function aapne(t) {
    setAktiv(t); setInnlegg([])
    setInnlegg(await hentInnlegg(t.id))
  }

  async function opprett(e) {
    e.preventDefault(); setFeil('')
    if (nyTittel.trim().length < 3) { setFeil('Gi tråden en tittel (minst 3 tegn).'); return }
    setJobber(true)
    try {
      const t = await opprettTraad(megId, rom.id, nyTittel)
      setNyTittel(''); setVisNy(false)
      await lastTraader()
      await aapne({ ...t, brukernavn: '', antall_svar: 0 })
    } catch (err) { setFeil(err.message) } finally { setJobber(false) }
  }

  async function svarPaa(e) {
    e.preventDefault()
    const t = svar.trim(); if (!t) return
    setJobber(true)
    try {
      const nytt = await sendInnlegg(megId, aktiv.id, t)
      setInnlegg((i) => [...i, { ...nytt, brukernavn: 'Deg', avatar_farge: '#12868C', avsender_id: megId }])
      setSvar('')
    } finally { setJobber(false) }
  }

  // ---- Tråd-detalj ----
  if (aktiv) {
    return (
      <div className="forum">
        <div className="forum-detalj-head">
          <button className="forum-tilbake" onClick={() => setAktiv(null)}>← Tilbake</button>
          <div className="forum-detalj-tittel">{aktiv.tittel}</div>
        </div>
        <div className="forum-innlegg-liste">
          {innlegg.length === 0 ? (
            <div className="dm-tom">Ingen svar ennå. Skriv det første.</div>
          ) : (
            innlegg.map((i) => (
              <div key={i.id} className="forum-innlegg">
                <div className="forum-inn-av" style={{ background: i.avatar_farge || '#8893A0' }}>{init(i.brukernavn)}</div>
                <div className="forum-inn-b">
                  <div className="forum-inn-topp"><span className="forum-inn-navn">{i.brukernavn}{i.avsender_id === megId ? ' (deg)' : ''}</span><span className="forum-inn-tid">{dato(i.opprettet)}</span></div>
                  <div className="forum-inn-tekst">{i.tekst}</div>
                </div>
                {i.avsender_id === megId && (
                  <button className="mod-flagg" title="Slett svaret ditt"
                    onClick={async () => {
                      if (!confirm('Slette dette svaret?')) return
                      await slettInnlegg(i.id)
                      setInnlegg((liste) => liste.filter((x) => x.id !== i.id))
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={enden} />
        </div>
        <form className="dm-input" onSubmit={svarPaa}>
          <input value={svar} onChange={(e) => setSvar(e.target.value)} placeholder="Skriv et svar …" />
          <button className="btn" disabled={jobber || !svar.trim()}>Svar</button>
        </form>
      </div>
    )
  }

  // ---- Trådliste ----
  return (
    <div className="forum">
      <div className="forum-topp">
        <div className="rom-oppdag-tittel" style={{ margin: 0 }}>Forum · #{rom.navn}</div>
        <button className="btn liten" onClick={() => setVisNy((v) => !v)}>{visNy ? 'Avbryt' : 'Ny tråd'}</button>
      </div>

      {visNy && (
        <form className="forum-ny" onSubmit={opprett}>
          <input value={nyTittel} onChange={(e) => setNyTittel(e.target.value)} placeholder="Tittel på tråden …" autoFocus />
          <button className="btn" disabled={jobber || !nyTittel.trim()}>Opprett</button>
        </form>
      )}
      {feil && <div className="import-feil" style={{ marginBottom: 12 }}>{feil}</div>}

      {laster ? (
        <div className="muted-note">Laster …</div>
      ) : traader.length === 0 ? (
        <div className="muted-note">Ingen tråder ennå. Start den første diskusjonen.</div>
      ) : (
        <div className="forum-liste">
          {traader.map((t) => (
            <div key={t.id} className="forum-rad-wrap">
              <button className="forum-rad" onClick={() => aapne(t)}>
                <div className="forum-rad-info">
                  <div className="forum-rad-tittel">{t.tittel}</div>
                  <div className="forum-rad-meta">av {t.brukernavn} · {dato(t.opprettet)}</div>
                </div>
                <div className="forum-rad-svar"><b>{Number(t.antall_svar)}</b> svar</div>
              </button>
              {t.avsender_id === megId && (
                <button className="mod-flagg traad-slett" title="Slett tråden din"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm('Slette tråden og alle svarene i den?')) return
                    await slettTraad(t.id)
                    await lastTraader()
                  }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
