import { useState } from 'react'
import { TEMAER, KILDER } from '../lib/skattekunnskap'
import Assistent from '../components/Assistent'
import Seo from '../components/Seo'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Blokk({ b }) {
  if (b.type === 'tekst') return <p className="sk-tekst">{b.tekst}</p>

  if (b.type === 'formel' || b.type === 'eksempel') {
    return (
      <div className={'sk-boks' + (b.type === 'eksempel' ? ' eks' : '')}>
        {b.tittel && <div className="sk-boks-tittel">{b.tittel}</div>}
        <table className="sk-tabell">
          <tbody>
            {b.rader.map((r, i) => (
              <tr key={i}>
                <td className="sk-k">{r[0]}</td>
                <td className="sk-v">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (b.type === 'fallgruve') {
    return (
      <div className="sk-fallgruve">
        <div className="sk-fg-topp">
          <span className="sk-fg-nr">{b.nr}</span>
          <h3>{b.tittel}</h3>
        </div>
        <p className="sk-tekst">{b.tekst}</p>
        {b.kilde && <div className="sk-kilde">{b.kilde}</div>}
        {b.eksempel && (
          <table className="sk-tabell sk-eks-tabell">
            <tbody>
              {b.eksempel.map((r, i) => (
                <tr key={i} className={i === b.eksempel.length - 1 ? 'sk-siste' : ''}>
                  <td className="sk-k">{r[0]}</td>
                  <td className="sk-v">{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  if (b.type === 'sammenlign') {
    return (
      <div className="sk-boks">
        <table className="sk-tabell sk-sammenlign">
          <tbody>
            {b.rader.map((r, i) => (
              <tr key={i}>
                <td className="sk-k">{r[0]}</td>
                <td className="sk-v sk-ask">{r[1]}</td>
                <td className="sk-v sk-vps">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (b.type === 'kildehenvisning') {
    return <div className="sk-kilde" style={{ marginTop: 12 }}>{b.tekst}</div>
  }

  if (b.type === 'liste') {
    return (
      <ul className="sk-liste">
        {b.punkter.map((p, i) => (
          <li key={i}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    )
  }

  return null
}

export default function Skattekunnskap() {
  const { user } = useAuth()
  const [aktiv, setAktiv] = useState(TEMAER[0].id)
  const tema = TEMAER.find((t) => t.id === aktiv)

  return (
    <div className="kalk-side">
      <Seo
        tittel="Norsk aksjeskatt forklart — skjermingsfradrag, ASK og VPS | Kursett"
        beskrivelse="Reglene for norsk aksjeskatt, forklart med kilder fra Skatteetaten. Skjermingsfradrag, ASK vs VPS, FIFU, 31.12-regelen og de vanligste fallgruvene."
        sti="/skatteregler"
      />
      <div className="kalk-topp">
        <Link to="/" className="kalk-logo" style={{ textDecoration: 'none' }}>
          <span className="kur">Kur</span><span className="sett">sett</span><span className="d" />
        </Link>
        <div className="kalk-nav">
          <Link to="/" className="kalk-lenke">Kalkulator</Link>
          {user ? (
            <Link to="/app" className="kalk-logginn">Til appen</Link>
          ) : (
            <Link to="/login" className="kalk-logginn">Logg inn</Link>
          )}
        </div>
      </div>

      <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '10px 0 0' }}>
      <div className="page-head">
        <h1>Norsk aksjeskatt</h1>
        <p className="page-sub">Reglene som faktisk gjelder — med kilder</p>
      </div>

      <div className="sk-disclaimer">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
        </svg>
        <div>
          Dette er en <b>forklaring</b>, ikke skatterådgivning. Kontroller alltid mot{' '}
          <a href="https://www.skatteetaten.no" target="_blank" rel="noreferrer">Skatteetaten</a>.
          Kursett er et verktøy — du er selv ansvarlig for skattemeldingen din.
        </div>
      </div>

      <div className="sk-layout">
        <nav className="sk-nav">
          {TEMAER.map((t) => (
            <button
              key={t.id}
              className={'sk-nav-knapp' + (aktiv === t.id ? ' aktiv' : '')}
              onClick={() => setAktiv(t.id)}
            >
              {t.tittel}
            </button>
          ))}
        </nav>

        <article className="sk-innhold">
          <h2 className="sk-tittel">{tema.tittel}</h2>
          <p className="sk-ingress">{tema.ingress}</p>
          {tema.innhold.map((b, i) => <Blokk key={i} b={b} />)}

          {tema.kilder && (
            <div className="sk-kilder">
              <div className="sk-kilder-tittel">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Sjekk selv hos Skatteetaten
              </div>
              {tema.kilder.map((k) => (
                <a key={k} href={KILDER[k].url} target="_blank" rel="noreferrer" className="sk-kilde-lenke">
                  {KILDER[k].tekst}
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                    <path d="M7 17 17 7M7 7h10v10" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </article>
      </div>
      </div>

      <Assistent />
    </div>
  )
}
