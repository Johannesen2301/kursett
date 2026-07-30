import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hentEgenProfil, lagreProfil, hentOffentligSammensetning } from '../lib/social'
import { hentBlokkerte, opphevBlokkering, slettMinKonto } from '../lib/moderering'
import { SEKTOR_NAVN, SEKTOR_FARGE } from '../lib/sectors'
import Band from '../components/Band'

const FARGER = ['#12868C', '#4d8bf0', '#4E7A8A', '#6FA08C', '#8E7CA8', '#C2A05A', '#9C6B52']

export default function Profil() {
  const { user } = useAuth()
  const [profil, setProfil] = useState(null)
  const [laster, setLaster] = useState(true)
  const [brukernavn, setBrukernavn] = useState('')
  const [bio, setBio] = useState('')
  const [farge, setFarge] = useState('#12868C')
  const [visBeholdninger, setVisBeholdninger] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')
  const [ok, setOk] = useState(false)
  const [sektorer, setSektorer] = useState([])
  const [blokkerte, setBlokkerte] = useState([])
  const [visSlett, setVisSlett] = useState(false)
  const [slettTekst, setSlettTekst] = useState('')
  const [sletter, setSletter] = useState(false)

  async function lastBlokkerte() {
    try { setBlokkerte(await hentBlokkerte()) } catch { /* ignorer */ }
  }

  async function last() {
    setLaster(true)
    await lastBlokkerte()
    const p = await hentEgenProfil(user.id)
    if (p) {
      setProfil(p)
      setBrukernavn(p.brukernavn)
      setBio(p.bio || '')
      setFarge(p.avatar_farge || '#12868C')
      setVisBeholdninger(!!p.vis_beholdninger)
      try {
        const s = await hentOffentligSammensetning(user.id)
        setSektorer(s.map((x) => ({ sektor: x.sektor, navn: SEKTOR_NAVN[x.sektor], farge: SEKTOR_FARGE[x.sektor], vekt: Number(x.vekt) })))
      } catch { /* ingen portefølje ennå */ }
    }
    setLaster(false)
  }
  useEffect(() => { last() /* eslint-disable-next-line */ }, [])

  async function lagre(e) {
    e.preventDefault()
    setFeil(''); setOk(false)
    const bn = brukernavn.trim()
    if (bn.length < 3) { setFeil('Brukernavn må være minst 3 tegn.'); return }
    if (!/^[a-zA-Z0-9_æøåÆØÅ]+$/.test(bn)) { setFeil('Brukernavn kan kun inneholde bokstaver, tall og understrek.'); return }
    setLagrer(true)
    try {
      await lagreProfil(user.id, { brukernavn: bn, bio: bio.trim(), avatar_farge: farge, vis_beholdninger: visBeholdninger })
      setOk(true)
      await last()
    } catch (err) {
      const m = String(err.message || err)
      if (m.includes('duplicate') || m.includes('unique')) setFeil('Brukernavnet er allerede tatt. Velg et annet.')
      else setFeil(m)
    } finally {
      setLagrer(false)
    }
  }

  if (laster) {
    return <div className="page"><div className="page-head"><h1>Profil</h1></div><div className="muted-note">Laster …</div></div>
  }

  const initial = (brukernavn || user.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page">
      <div className="page-head">
        <h1>{profil ? 'Din profil' : 'Opprett profil'}</h1>
        <p className="page-sub">{profil ? 'Slik ser andre investorer deg' : 'Bli synlig i fellesskapet'}</p>
      </div>

      <div className="profil-grid">
        <form className="panel" onSubmit={lagre}>
          <div className="field">
            <span>Brukernavn</span>
            <input value={brukernavn} onChange={(e) => setBrukernavn(e.target.value)} placeholder="f.eks. utbyttejeger" />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <span>Bio <small style={{ color: 'var(--faint)', fontWeight: 400 }}>(valgfritt)</small></span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160}
              placeholder="Langsiktig utbytteinvestor med fokus på energi og sjømat." />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <span>Avatarfarge</span>
            <div className="farge-rad">
              {FARGER.map((f) => (
                <button type="button" key={f} className={'farge' + (farge === f ? ' valgt' : '')}
                  style={{ background: f }} onClick={() => setFarge(f)} aria-label={f} />
              ))}
            </div>
          </div>

          <div className="personvern-boks">
            <div className="pv-tittel">Personvern</div>
            <label className="pv-valg">
              <input type="checkbox" checked={visBeholdninger} onChange={(e) => setVisBeholdninger(e.target.checked)} />
              <span>
                <b>Vis hvilke aksjer jeg eier</b>
                <small>Andre ser aksjene dine med vekt i prosent. Er den av, vises kun sektorbåndet ditt.</small>
              </span>
            </label>
            <div className="pv-alltid">Kronebeløp, antall aksjer og porteføljeverdi vises <b>aldri</b> til andre — uansett.</div>
          </div>

          {feil && <div className="import-feil" style={{ marginTop: 16 }}>{feil}</div>}
          {ok && <div className="auth-info" style={{ marginTop: 16 }}>Profilen er lagret.</div>}

          <button className="btn" style={{ marginTop: 18 }} disabled={lagrer}>
            {lagrer ? 'Lagrer …' : profil ? 'Lagre endringer' : 'Opprett profil'}
          </button>

          <div className="comp-note" style={{ marginTop: 18 }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>
            Med en profil blir sammensetningen din synlig for andre — i prosent, aldri i kroner.
          </div>
        </form>

        <div className="panel">
          <div className="profil-preview">
            <div className="pp-av" style={{ background: farge }}>{initial}</div>
            <div>
              <div className="pp-navn">{brukernavn || 'Brukernavn'}</div>
              <div className="pp-bio">{bio || 'Ingen bio ennå'}</div>
            </div>
          </div>
          {profil && sektorer.length > 0 ? (
            <>
              <div className="pp-lbl">Din offentlige sammensetning</div>
              <Band sektorer={sektorer} height={40} />
              <Link to={`/app/investor/${profil.brukernavn}`} className="btn ghost" style={{ marginTop: 18, display: 'inline-block' }}>
                Se din offentlige profil →
              </Link>
            </>
          ) : (
            <div className="muted-note" style={{ marginTop: 10 }}>
              Importer porteføljen din under «Min portefølje» for å vise sammensetning på profilen.
            </div>
          )}

          {blokkerte.length > 0 && (
            <div className="blokk-liste">
              <div className="pp-lbl" style={{ marginTop: 22 }}>Blokkerte brukere</div>
              {blokkerte.map((b) => (
                <div key={b.bruker_id} className="blokk-rad">
                  <div className="blokk-av" style={{ background: b.avatar_farge }}>
                    {(b.brukernavn || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="blokk-navn">{b.brukernavn}</span>
                  <button className="btn ghost liten"
                    onClick={async () => { await opphevBlokkering(user.id, b.bruker_id); await lastBlokkerte() }}>
                    Opphev
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fare-sone">
        <div className="fs-tittel">Slett konto</div>
        <p className="fs-tekst">
          Sletter du kontoen, fjernes alt: portefølje, profil, meldinger, vennskap og rom du eier.
          Dette kan ikke angres.
        </p>
        <button className="btn fare" onClick={() => setVisSlett(true)}>Slett kontoen min</button>
      </div>

      {visSlett && (
        <div className="mod-overlay" onClick={(e) => { if (e.target.className === 'mod-overlay') setVisSlett(false) }}>
          <div className="mod-dialog">
            <h3>Slette kontoen din?</h3>
            <p className="mod-tekst">
              Alt slettes permanent: porteføljen din, profilen, alle meldinger, vennskap og rom du
              har opprettet. Dette kan <b>ikke</b> angres.
            </p>
            <div className="field" style={{ marginTop: 18 }}>
              <span>Skriv <b>SLETT</b> for å bekrefte</span>
              <input value={slettTekst} onChange={(e) => setSlettTekst(e.target.value)} placeholder="SLETT" />
            </div>
            <div className="mod-knapper">
              <button className="btn ghost" onClick={() => setVisSlett(false)} disabled={sletter}>Avbryt</button>
              <button className="btn fare" disabled={slettTekst !== 'SLETT' || sletter}
                onClick={async () => {
                  setSletter(true)
                  try { await slettMinKonto() } catch (e) { setFeil(e.message); setSletter(false) }
                }}>
                {sletter ? 'Sletter …' : 'Slett permanent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
