import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hentEgenProfil } from '../lib/social'

export default function KreverBrukernavn({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('laster') // 'laster' | 'ok' | 'mangler'

  useEffect(() => {
    hentEgenProfil(user.id)
      .then((p) => setStatus(p ? 'ok' : 'mangler'))
      .catch(() => setStatus('mangler'))
  }, [user.id])

  if (status === 'laster') return <div className="page"><div className="muted-note">Laster …</div></div>

  if (status === 'mangler') {
    return (
      <div className="page">
        <div className="import-card">
          <div className="import-icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
          </div>
          <h2>Velg et brukernavn først</h2>
          <p>For å delta i fellesskapet — rom, venner og meldinger — må du opprette en profil med brukernavn. Da vises du med navn i stedet for «Ukjent».</p>
          <Link to="/app/profil" className="btn">Opprett profil</Link>
        </div>
      </div>
    )
  }

  return children
}
