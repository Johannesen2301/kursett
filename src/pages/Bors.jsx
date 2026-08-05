import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BORS_UNIVERS } from '../lib/borsUniverse'
import { hentBorsPriser } from '../lib/prices'
import { slaSammenRader, filtrerOgSorter, grupperEtterSektor, beregnHoydepunkter, marketNavn } from '../lib/bors'
import { formaterPst } from '../lib/portfolio'
import { SEKTOR_FARGE, SEKTOR_NAVN } from '../lib/sectors'
import Assistent from '../components/Assistent'
import Seo from '../components/Seo'

const SEKTOR_REKKEFOLGE = [...new Set(BORS_UNIVERS.map((u) => u.sektor))]
  .sort((a, b) => (SEKTOR_NAVN[a] || a).localeCompare(SEKTOR_NAVN[b] || b, 'nb'))

const MARKED_FANER = [
  { verdi: 'alle', navn: 'Alle markeder' },
  { verdi: 'no', navn: 'Norge' },
  { verdi: 'us', navn: 'USA' },
  { verdi: 'asia', navn: 'Asia' },
]

function Pil({ aktiv, retning }) {
  if (!aktiv) return null
  return <span style={{ marginLeft: 4, fontSize: 10 }}>{retning === 'asc' ? '▲' : '▼'}</span>
}

export default function Bors() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Denne siden brukes to steder: den offentlige /bors (egen header, ingen
  // sidebar) og /app/bors (samme innhold, men inne i appens sidebar-skall —
  // ingen vits å vise en ekstra "offentlig" header/footer der).
  const iApp = location.pathname.startsWith('/app')
  const [rader, setRader] = useState(() => slaSammenRader(BORS_UNIVERS, null))
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')
  const [marked, setMarked] = useState('alle')
  const [sektor, setSektor] = useState('alle')
  const [utbytte, setUtbytte] = useState('alle')
  const [sok, setSok] = useState('')
  const [apneGrupper, setApneGrupper] = useState(() => new Set())
  const [sortKolonne, setSortKolonne] = useState('navn')
  const [sortRetning, setSortRetning] = useState('asc')

  useEffect(() => {
    let aktiv = true
    hentBorsPriser(BORS_UNIVERS.map((u) => u.ticker))
      .then((data) => { if (aktiv) setRader(slaSammenRader(BORS_UNIVERS, data)) })
      .catch((err) => { if (aktiv) setFeil('Fikk ikke hentet live kurser akkurat nå — viser aksjelisten uten tall. (' + (err?.message || String(err)) + ')') })
      .finally(() => { if (aktiv) setLaster(false) })
    return () => { aktiv = false }
  }, [])

  function bytSortering(kolonne) {
    if (kolonne === sortKolonne) setSortRetning((r) => (r === 'asc' ? 'desc' : 'asc'))
    else { setSortKolonne(kolonne); setSortRetning('asc') }
  }

  const visning = useMemo(
    () => filtrerOgSorter(rader, { marked, sektor, utbytte, sok, sortKolonne, sortRetning }),
    [rader, marked, sektor, utbytte, sok, sortKolonne, sortRetning]
  )

  const hoydepunkter = useMemo(() => beregnHoydepunkter(visning), [visning])

  // Gruppering (med sammenleggbare seksjoner) gir bare mening når man faktisk blar
  // gjennom «alle sektorer» uten søk — med et treff-søk eller et sektorvalg er
  // resultatet allerede lite nok til å vises flatt.
  const grupperer = sektor === 'alle' && !sok.trim()
  const grupper = useMemo(
    () => (grupperer ? grupperEtterSektor(visning, SEKTOR_REKKEFOLGE) : [{ sektor, rader: visning }]),
    [visning, sektor, grupperer]
  )

  function bytGruppe(sektorKey) {
    setApneGrupper((forrige) => {
      const ny = new Set(forrige)
      if (ny.has(sektorKey)) ny.delete(sektorKey)
      else ny.add(sektorKey)
      return ny
    })
  }

  const th = (kolonne, label, klasse) => (
    <th className={klasse} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => bytSortering(kolonne)}>
      {label}<Pil aktiv={sortKolonne === kolonne} retning={sortRetning} />
    </th>
  )

  const innhold = (
    <>
      <div className="page" style={{ maxWidth: 1080, margin: '0 auto', padding: '10px 0 0' }}>
        <div className="page-head">
          <h1>Aksjescreener</h1>
          <p className="page-sub">{BORS_UNIVERS.length} aksjer på Oslo Børs, i USA og Asia — filtrer og sorter</p>
        </div>

        <div className="sk-disclaimer">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          <div>
            Dette er offentlig markedsdata — <b>ingen rangering, ingen kjøps- eller salgsanbefaling</b>. Tallene
            kan være inntil en time forsinket. Kursett er ikke investeringsrådgivning.
          </div>
        </div>

        {feil && <div className="import-feil" style={{ marginTop: 16 }}>{feil}</div>}

        <div className="kalk-faner" style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden' }}>
          {MARKED_FANER.map((f) => (
            <button key={f.verdi} type="button" className={'kalk-fane' + (marked === f.verdi ? ' on' : '')} onClick={() => setMarked(f.verdi)}>
              {f.navn}
            </button>
          ))}
        </div>

        <div className="bors-stripe">
          <div className="bors-stripe-item">
            <span className="bors-stripe-k">Dagens vinner</span>
            {hoydepunkter.vinner ? <><b>{hoydepunkter.vinner.navn}</b> <span style={{ color: 'var(--up)', fontWeight: 600 }}>{formaterPst(hoydepunkter.vinner.dagEndringPst, true)}</span></> : '–'}
          </div>
          <div className="bors-stripe-item">
            <span className="bors-stripe-k">Dagens taper</span>
            {hoydepunkter.taper ? <><b>{hoydepunkter.taper.navn}</b> <span style={{ color: 'var(--down)', fontWeight: 600 }}>{formaterPst(hoydepunkter.taper.dagEndringPst, true)}</span></> : '–'}
          </div>
          <div className="bors-stripe-item">
            <span className="bors-stripe-k">Høyest dir.avk.</span>
            {hoydepunkter.hoyestAvkastning ? <><b>{hoydepunkter.hoyestAvkastning.navn}</b> {formaterPst(hoydepunkter.hoyestAvkastning.direkteavkastning)}</> : '–'}
          </div>
          <div className="bors-stripe-item">
            <span className="bors-stripe-k">Aksjer i visning</span>
            <b>{hoydepunkter.antall}</b> <span style={{ color: 'var(--muted)' }}>{marked === 'alle' ? 'alle markeder' : marketNavn(marked)}</span>
          </div>
        </div>

        <div className="bors-toolbar">
          <input
            type="text" className="kalk-select bors-sok" style={{ width: 'auto', minWidth: 200, fontWeight: 400, cursor: 'text' }}
            placeholder="Søk etter aksje eller ticker …" value={sok} onChange={(e) => setSok(e.target.value)}
          />
          <select className="kalk-select" style={{ width: 'auto', minWidth: 180 }} value={sektor} onChange={(e) => setSektor(e.target.value)}>
            <option value="alle">Alle sektorer</option>
            {SEKTOR_REKKEFOLGE.map((s) => (<option key={s} value={s}>{SEKTOR_NAVN[s] || s}</option>))}
          </select>
          <div className="bors-segment">
            <button type="button" className={utbytte === 'alle' ? 'on' : ''} onClick={() => setUtbytte('alle')}>Alle</button>
            <button type="button" className={utbytte === 'med' ? 'on' : ''} onClick={() => setUtbytte('med')}>Med utbytte</button>
            <button type="button" className={utbytte === 'uten' ? 'on' : ''} onClick={() => setUtbytte('uten')}>Uten utbytte</button>
          </div>
        </div>

        {visning.length === 0 ? (
          <div className="panel muted-note" style={{ textAlign: 'center' }}>Ingen aksjer matcher filteret.</div>
        ) : (
          <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="holdings bors-tabell">
              <thead>
                <tr>
                  {th('navn', 'Aksje')}
                  {th('pris', 'Kurs', 'r')}
                  {th('dagEndringPst', 'I dag', 'r')}
                  <th>52-ukers plassering</th>
                  {th('direkteavkastning', 'Dir.avk.', 'r')}
                </tr>
              </thead>
              <tbody>
                {grupper.map((g) => (
                  <Fragment key={g.sektor}>
                    {grupperer && (
                      <tr className="bors-gruppe-rad" style={{ cursor: 'pointer' }} onClick={() => bytGruppe(g.sektor)}>
                        <td colSpan={5} style={{ background: 'var(--paper)', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                          <span style={{ display: 'inline-block', width: 10, fontSize: 11, color: 'var(--faint)' }}>{apneGrupper.has(g.sektor) ? '▼' : '▶'}</span>
                          <span className="swdot" style={{ background: SEKTOR_FARGE[g.sektor], marginRight: 8 }} />
                          <b style={{ fontSize: 14 }}>{SEKTOR_NAVN[g.sektor] || g.sektor}</b>
                          <span style={{ fontSize: 12.5, color: 'var(--faint)', marginLeft: 8 }}>{g.rader.length} aksje{g.rader.length === 1 ? '' : 'r'}</span>
                        </td>
                      </tr>
                    )}
                    {(!grupperer || apneGrupper.has(g.sektor)) && g.rader.map((r) => (
                      <tr key={r.ticker} className="bors-rad-klikkbar" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/aksje/' + r.ticker)}>
                        <td><div className="tick"><span className="swdot" style={{ background: SEKTOR_FARGE[r.sektor] }} /><span className="nm">{r.navn}</span><span style={{ marginLeft: 6, fontSize: 12, color: 'var(--faint)' }}>{marketNavn(r.marked)}</span></div></td>
                        <td className="r mono" data-l="Kurs">{r.harData ? `${r.pris.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} ${r.valuta || ''}` : '–'}</td>
                        <td className="r" data-l="I dag">
                          {r.dagEndringPst != null ? (
                            <span className={'bors-badge ' + (r.dagEndringPst >= 0 ? 'opp' : 'ned')}>{formaterPst(r.dagEndringPst, true)}</span>
                          ) : '–'}
                        </td>
                        <td data-l="52-ukers plassering">
                          {r.rangePosisjon != null ? (
                            <div className="bors-range"><div className="bors-range-fyll" style={{ left: r.rangePosisjon + '%' }} /></div>
                          ) : '–'}
                        </td>
                        <td className="r mono" data-l="Dir.avk.">{r.direkteavkastning != null ? formaterPst(r.direkteavkastning) : '–'}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {laster && <div className="muted-note" style={{ marginTop: 12 }}>Henter live kurser …</div>}

        {!iApp && (
          <div className="kalk-bunn">
            <div className="kalk-videre">
              <Link to="/" className="kalk-kort">
                <b>Regn ut skjermingsfradraget</b>
                <span>Gratis kalkulator for VPS og ASK</span>
              </Link>
              <Link to="/login" className="kalk-kort">
                <b>Importer porteføljen din</b>
                <span>Se skatt, utbytte og sammensetning automatisk</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )

  if (iApp) return innhold

  return (
    <div className="kalk-side">
      <Seo
        tittel="Aksjescreener — sammenlign aksjer på Oslo Børs, i USA og Asia | Kursett"
        beskrivelse="Gratis aksjescreener med kurs, dagsendring, 52-ukers plassering og direkteavkastning for et kuratert utvalg aksjer på Oslo Børs, i USA og Asia. Ingen rangering, ingen kjøps- eller salgsanbefaling."
        sti="/bors"
      />
      <div className="kalk-topp">
        <Link to="/" className="kalk-logo" style={{ textDecoration: 'none' }}>
          <span className="kur">Kur</span><span className="sett">sett</span><span className="d" />
        </Link>
        <div className="kalk-nav">
          <Link to="/skatteregler" className="kalk-lenke">Skatteregler</Link>
          {user ? (
            <Link to="/app" className="kalk-logginn">Til appen</Link>
          ) : (
            <Link to="/login" className="kalk-logginn">Logg inn</Link>
          )}
        </div>
      </div>

      {innhold}

      <Assistent />
    </div>
  )
}
