import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  hentProfilPaaBrukernavn, hentOffentligSammensetning, hentOffentligeBeholdninger,
  folgerTall, sjekkOmFolger, folg, sluttAaFolge,
} from '../lib/social'
import { SEKTOR_NAVN, SEKTOR_FARGE } from '../lib/sectors'
import Band from '../components/Band'

export default function InvestorProfil() {
  const { brukernavn } = useParams()
  const { user } = useAuth()

  const [profil, setProfil] = useState(null)
  const [laster, setLaster] = useState(true)
  const [finnesIkke, setFinnesIkke] = useState(false)
  const [sektorer, setSektorer] = useState([])
  const [beholdninger, setBeholdninger] = useState([])
  const [tall, setTall] = useState({ folgere: 0, folger: 0 })
  const [erFolger, setErFolger] = useState(false)
  const [jobber, setJobber] = useState(false)

  async function last() {
    setLaster(true); setFinnesIkke(false)
    const p = await hentProfilPaaBrukernavn(brukernavn)
    if (!p) { setFinnesIkke(true); setLaster(false); return }
    setProfil(p)
    const [samm, beh, t] = await Promise.all([
      hentOffentligSammensetning(p.id).catch(() => []),
      hentOffentligeBeholdninger(p.id).catch(() => []),
      folgerTall(p.id),
    ])
    setSektorer(samm.map((s) => ({ sektor: s.sektor, navn: SEKTOR_NAVN[s.sektor], farge: SEKTOR_FARGE[s.sektor], vekt: Number(s.vekt) })))
    setBeholdninger(beh)
    setTall(t)
    if (user && user.id !== p.id) setErFolger(await sjekkOmFolger(user.id, p.id))
    setLaster(false)
  }
  useEffect(() => { last() /* eslint-disable-next-line */ }, [brukernavn])

  async function toggleFolg() {
    if (!profil || !user) return
    setJobber(true)
    try {
      if (erFolger) {
        await sluttAaFolge(user.id, profil.id)
        setErFolger(false); setTall((t) => ({ ...t, folgere: Math.max(0, t.folgere - 1) }))
      } else {
        await folg(user.id, profil.id)
        setErFolger(true); setTall((t) => ({ ...t, folgere: t.folgere + 1 }))
      }
    } finally {
      setJobber(false)
    }
  }

  if (laster) return <div className="page"><div className="muted-note">Laster …</div></div>
  if (finnesIkke) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Fant ikke investoren</h1>
          <p className="page-sub">Ingen profil med brukernavnet «{brukernavn}».</p>
        </div>
        <Link to="/app/toppliste" className="btn ghost">Til topplista</Link>
      </div>
    )
  }

  const egen = user && user.id === profil.id
  const initial = (profil.brukernavn || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page">
      <div className="investor-topp">
        <div className="it-av" style={{ background: profil.avatar_farge || '#12868C' }}>{initial}</div>
        <div className="it-info">
          <h1>{profil.brukernavn}</h1>
          {profil.bio && <p className="it-bio">{profil.bio}</p>}
          <div className="it-tall">
            <span><b>{tall.folgere}</b> følgere</span>
            <span><b>{tall.folger}</b> følger</span>
          </div>
        </div>
        {egen ? (
          <Link to="/app/profil" className="btn ghost">Rediger profil</Link>
        ) : user ? (
          <button className={'btn' + (erFolger ? ' ghost' : '')} disabled={jobber} onClick={toggleFolg}>
            {jobber ? '…' : erFolger ? 'Følger ✓' : 'Følg'}
          </button>
        ) : null}
      </div>

      {sektorer.length > 0 ? (
        <div className="panel">
          <div className="panel-h"><h2>Sammensetning</h2><span className="hint">I prosent</span></div>
          <Band sektorer={sektorer} />
          <div className="legend">
            {sektorer.map((s) => (
              <div key={s.sektor} className="legend-item"><span className="sw" style={{ background: s.farge }} />{s.navn} <b>{s.vekt}%</b></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel"><div className="muted-note">Denne investoren har ikke delt en portefølje ennå.</div></div>
      )}

      {beholdninger.length > 0 ? (
        <div className="panel">
          <div className="panel-h"><h2>Beholdning</h2><span className="hint">Vekt i prosent</span></div>
          <table className="holdings">
            <thead><tr><th>Aksje</th><th className="r">Vekt</th></tr></thead>
            <tbody>
              {beholdninger.map((b, i) => (
                <tr key={i}>
                  <td><div className="tick"><span className="swdot" style={{ background: SEKTOR_FARGE[b.sektor] }} /><span className="nm">{b.navn}</span></div></td>
                  <td className="r mono wt" data-l="Vekt">{Number(b.vekt)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="comp-note" style={{ marginTop: 16 }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>
            Kun sammensetning i prosent vises — aldri kronebeløp eller antall.
          </div>
        </div>
      ) : sektorer.length > 0 ? (
        <div className="panel">
          <div className="skjult-boks">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 9 7a12 12 0 0 1-2.2 3M6.2 6.2A12.4 12.4 0 0 0 3 12c0 2.5 4 7 9 7a9.6 9.6 0 0 0 3.4-.6" /></svg>
            <div>
              <b>{profil.brukernavn} har valgt å ikke vise enkeltaksjer</b>
              <span>Sektorsammensetningen over er offentlig, men aksjelista er privat.</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
