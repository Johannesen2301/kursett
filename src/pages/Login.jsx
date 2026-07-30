import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'
export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setInfo('')
    if (!email || !password) { setError('Fyll inn e-post og passord.'); return }
    setBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { data, error } = await fn(email, password)
    setBusy(false)
    if (error) { setError(error.message); return }
    if (mode === 'signup' && !data.session) { setInfo('Sjekk e-posten din for å bekrefte kontoen, og logg inn.'); setMode('login'); return }
    navigate('/app')
  }
  return (
    <div className="auth-screen">
      <Seo tittel="Logg inn | Kursett" beskrivelse="Logg inn på Kursett." sti="/login" ingenIndeksering /><div className="auth-card">
      <div className="auth-logo"><span className="kur">Kur</span><span className="sett">sett</span><span className="d" /></div>
      <h1 className="auth-title">{mode === 'login' ? 'Logg inn' : 'Opprett konto'}</h1>
      <p className="auth-sub">{mode === 'login' ? 'Velkommen tilbake til porteføljen din.' : 'Kom i gang — gratis, på under ett minutt.'}</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="field"><span>E-post</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@epost.no" autoComplete="email" /></label>
        <label className="field"><span>Passord</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        <button type="submit" className="auth-btn" disabled={busy}>{busy ? 'Vent litt …' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}</button>
      </form>
      <div className="auth-switch">{mode === 'login' ? (<>Ny her? <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Opprett konto</button></>) : (<>Har du konto? <button onClick={() => { setMode('login'); setError(''); setInfo('') }}>Logg inn</button></>)}</div>
    </div></div>
  )
}
