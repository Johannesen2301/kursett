import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hentToppliste } from '../lib/social'

export default function Toppliste() {
  const [liste, setListe] = useState([])
  const [laster, setLaster] = useState(true)

  useEffect(() => {
    hentToppliste()
      .then((d) => { setListe(d); setLaster(false) })
      .catch(() => setLaster(false))
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Toppliste</h1>
        <p className="page-sub">Investorer i fellesskapet</p>
      </div>

      <div className="boundary-note">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        Rangert etter følgere inntil videre. Rangering på risikojustert avkastning (Sharpe) kommer når vi sporer avkastning over tid.
      </div>

      {laster ? (
        <div className="muted-note">Laster …</div>
      ) : liste.length === 0 ? (
        <div className="panel"><div className="muted-note">Ingen profiler ennå. Opprett din egen under «Profil» og bli den første.</div></div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          {liste.map((p, i) => (
            <Link to={`/app/investor/${p.brukernavn}`} key={p.id} className="lb-row">
              <div className={'lb-rank' + (i < 3 ? ' topp' : '')}>{i + 1}</div>
              <div className="lb-av" style={{ background: p.avatar_farge || '#12868C' }}>
                {(p.brukernavn || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="lb-info">
                <div className="lb-navn">{p.brukernavn}</div>
                {p.bio && <div className="lb-bio">{p.bio}</div>}
              </div>
              <div className="lb-folgere"><b>{p.antall_folgere}</b> følgere</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
