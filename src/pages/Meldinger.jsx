import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  hentVenner, hentInnkommende, hentUtgaaende, sendVenneforesporsel,
  godtaForesporsel, avslaEllerFjern, hentMeldinger, sendMelding, abonnerPaaMeldinger, slettMelding,
} from '../lib/friends'
import DMChat from '../components/DMChat'
import { useVarsler, markerLest } from '../context/VarselContext'

const init = (n) => (n || '?').slice(0, 2).toUpperCase()

export default function Meldinger() {
  const { user } = useAuth()
  const varsler = useVarsler()
  const [venner, setVenner] = useState([])
  const [innkommende, setInnkommende] = useState([])
  const [utgaaende, setUtgaaende] = useState([])
  const [laster, setLaster] = useState(true)

  const [aktivVenn, setAktivVenn] = useState(null)
  const [meldinger, setMeldinger] = useState([])
  const aktivRef = useRef(null)

  const [fane, setFane] = useState('venner')
  const [nyttNavn, setNyttNavn] = useState('')
  const [leggFeil, setLeggFeil] = useState('')
  const [leggOk, setLeggOk] = useState('')
  const [jobber, setJobber] = useState(false)

  async function lastAlt() {
    try {
      const [v, inn, ut] = await Promise.all([hentVenner(), hentInnkommende(), hentUtgaaende()])
      setVenner(v); setInnkommende(inn); setUtgaaende(ut)
    } finally { setLaster(false) }
  }

  useEffect(() => {
    lastAlt()
    const rydd = abonnerPaaMeldinger(user.id, (ny) => {
      if (aktivRef.current && ny.avsender_id === aktivRef.current) {
        setMeldinger((m) => (m.some((x) => x.id === ny.id) ? m : [...m, ny]))
      }
    })
    return rydd
    // eslint-disable-next-line
  }, [])

  useEffect(() => { aktivRef.current = aktivVenn?.venn_id || null }, [aktivVenn])

  async function aapneDM(v) {
    setAktivVenn(v)
    setMeldinger([])
    const m = await hentMeldinger(user.id, v.venn_id)
    setMeldinger(m)
    await markerLest('dm', v.venn_id)
    varsler.refresh()
  }

  async function send(tekst) {
    const ny = await sendMelding(user.id, aktivVenn.venn_id, tekst)
    setMeldinger((m) => [...m, ny])
  }

  async function slett(id) {
    await slettMelding(id)
    setMeldinger((m) => m.filter((x) => x.id !== id))
  }

  async function godta(id) { setJobber(true); try { await godtaForesporsel(id); await lastAlt() } finally { setJobber(false) } }
  async function avsla(id) { setJobber(true); try { await avslaEllerFjern(id); if (aktivVenn) setAktivVenn(null); await lastAlt() } finally { setJobber(false) } }

  async function leggTil(e) {
    e.preventDefault()
    setLeggFeil(''); setLeggOk('')
    if (!nyttNavn.trim()) return
    setJobber(true)
    try {
      const navn = await sendVenneforesporsel(user.id, nyttNavn)
      setLeggOk('Forespørsel sendt til ' + navn + '.')
      setNyttNavn('')
      await lastAlt()
    } catch (err) { setLeggFeil(err.message) }
    finally { setJobber(false) }
  }

  if (laster) return <div className="page"><div className="page-head"><h1>Meldinger</h1></div><div className="muted-note">Laster …</div></div>

  return (
    <div className="page meldinger-page">
      <div className="page-head"><h1>Meldinger</h1><p className="page-sub">Venner og direktemeldinger</p></div>

      <div className="dm-layout">
        <div className="dm-sidebar">
          <button className={'dm-venner-btn' + (!aktivVenn ? ' aktiv' : '')} onClick={() => setAktivVenn(null)}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a7 7 0 0 1 14 0M17 5a3 3 0 0 1 0 7M15 20a7 7 0 0 0-2-5" /></svg>
            Venner
            {innkommende.length > 0 && <span className="dm-badge">{innkommende.length}</span>}
          </button>
          <div className="dm-liste-tittel">Direktemeldinger</div>
          {venner.length === 0 ? (
            <div className="dm-liste-tom">Ingen venner ennå</div>
          ) : (
            venner.map((v) => (
              <button key={v.vennskap_id} className={'dm-venn' + (aktivVenn?.venn_id === v.venn_id ? ' aktiv' : '')} onClick={() => aapneDM(v)}>
                <div className="dm-venn-av" style={{ background: v.avatar_farge || '#12868C' }}>{init(v.brukernavn)}</div>
                <span className="dm-venn-navn">{v.brukernavn}</span>
                {varsler.perVenn?.[v.venn_id] > 0 && (
                  <span className="ulest-tall">{varsler.perVenn[v.venn_id]}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="dm-hoved">
          {aktivVenn ? (
            <DMChat venn={aktivVenn} meldinger={meldinger} megId={user.id} onSend={send} onSlett={slett}
              onBlokkert={async () => { setAktivVenn(null); await lastAlt() }} />
          ) : (
            <div className="venner-panel">
              <div className="fane-rad">
                <button className={'fane' + (fane === 'venner' ? ' on' : '')} onClick={() => setFane('venner')}>Venner ({venner.length})</button>
                <button className={'fane' + (fane === 'foresp' ? ' on' : '')} onClick={() => setFane('foresp')}>Forespørsler{innkommende.length > 0 ? ' (' + innkommende.length + ')' : ''}</button>
                <button className={'fane' + (fane === 'legg' ? ' on' : '')} onClick={() => setFane('legg')}>Legg til venn</button>
              </div>

              {fane === 'venner' && (
                <div className="fane-innhold">
                  {venner.length === 0 ? <div className="muted-note">Du har ingen venner ennå. Legg til noen via brukernavn.</div> :
                    venner.map((v) => (
                      <div key={v.vennskap_id} className="venn-rad">
                        <div className="venn-av" style={{ background: v.avatar_farge || '#12868C' }}>{init(v.brukernavn)}</div>
                        <div className="venn-info"><div className="venn-navn">{v.brukernavn}</div>{v.bio && <div className="venn-bio">{v.bio}</div>}</div>
                        <button className="btn ghost liten" onClick={() => aapneDM(v)}>Melding</button>
                        <button className="btn ghost liten" onClick={() => avsla(v.vennskap_id)} disabled={jobber}>Fjern</button>
                      </div>
                    ))}
                </div>
              )}

              {fane === 'foresp' && (
                <div className="fane-innhold">
                  {innkommende.length === 0 && utgaaende.length === 0 && <div className="muted-note">Ingen ventende forespørsler.</div>}
                  {innkommende.length > 0 && <div className="foresp-tittel">Innkommende</div>}
                  {innkommende.map((r) => (
                    <div key={r.vennskap_id} className="venn-rad">
                      <div className="venn-av" style={{ background: r.avatar_farge || '#12868C' }}>{init(r.brukernavn)}</div>
                      <div className="venn-info"><div className="venn-navn">{r.brukernavn}</div></div>
                      <button className="btn liten" onClick={() => godta(r.vennskap_id)} disabled={jobber}>Godta</button>
                      <button className="btn ghost liten" onClick={() => avsla(r.vennskap_id)} disabled={jobber}>Avslå</button>
                    </div>
                  ))}
                  {utgaaende.length > 0 && <div className="foresp-tittel">Sendt</div>}
                  {utgaaende.map((r) => (
                    <div key={r.vennskap_id} className="venn-rad">
                      <div className="venn-av" style={{ background: r.avatar_farge || '#12868C' }}>{init(r.brukernavn)}</div>
                      <div className="venn-info"><div className="venn-navn">{r.brukernavn}</div><div className="venn-bio">Venter på svar</div></div>
                      <button className="btn ghost liten" onClick={() => avsla(r.vennskap_id)} disabled={jobber}>Trekk tilbake</button>
                    </div>
                  ))}
                </div>
              )}

              {fane === 'legg' && (
                <div className="fane-innhold">
                  <form onSubmit={leggTil} className="legg-form">
                    <div className="field"><span>Brukernavn</span>
                      <div className="legg-rad">
                        <input value={nyttNavn} onChange={(e) => setNyttNavn(e.target.value)} placeholder="@brukernavn" />
                        <button className="btn" disabled={jobber || !nyttNavn.trim()}>Send forespørsel</button>
                      </div>
                    </div>
                    {leggFeil && <div className="import-feil" style={{ marginTop: 14 }}>{leggFeil}</div>}
                    {leggOk && <div className="auth-info" style={{ marginTop: 14 }}>{leggOk}</div>}
                    <div className="muted-note" style={{ marginTop: 14, fontSize: '13.5px' }}>Finn brukernavn via topplista eller en investorprofil.</div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
