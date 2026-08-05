import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BORS_UNIVERS } from '../lib/borsUniverse'
import { hentBorsPriser, hentAksjeHistorikk } from '../lib/prices'
import { hentNyheter, tidSiden } from '../lib/nyheter'
import { slaSammenRader, beregnSvgPunkter, marketNavn } from '../lib/bors'
import { formaterPst } from '../lib/portfolio'
import { SEKTOR_FARGE, SEKTOR_NAVN } from '../lib/sectors'

export default function AksjeDetalj() {
  const { ticker } = useParams()
  const aksje = useMemo(() => BORS_UNIVERS.find((u) => u.ticker === ticker), [ticker])

  const [rad, setRad] = useState(null)
  const [serie, setSerie] = useState([])
  const [nyheter, setNyheter] = useState([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')

  useEffect(() => {
    if (!aksje) { setLaster(false); return }
    let aktiv = true
    setLaster(true); setFeil('')
    Promise.all([
      hentBorsPriser([ticker]).catch(() => null),
      hentAksjeHistorikk(ticker).catch(() => null),
      hentNyheter([ticker], { [ticker]: aksje.navn }).catch(() => null),
    ]).then(([prisdata, historikk, nyhetsdata]) => {
      if (!aktiv) return
      setRad(slaSammenRader([aksje], prisdata)[0])
      setSerie(historikk?.serie || [])
      setNyheter(nyhetsdata?.nyheter || [])
      if (!prisdata && !historikk && !nyhetsdata) setFeil('Fikk ikke hentet data akkurat nå — prøv igjen senere.')
    }).finally(() => { if (aktiv) setLaster(false) })
    return () => { aktiv = false }
  }, [ticker, aksje])

  if (!aksje) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Fant ikke aksjen</h1>
          <p className="page-sub">Ingen aksje med ticker «{ticker}» i utvalget vårt.</p>
        </div>
        <Link to="/app/bors" className="btn ghost">Til aksjescreeneren</Link>
      </div>
    )
  }

  if (laster) return <div className="page"><div className="muted-note">Laster …</div></div>

  const punkter = beregnSvgPunkter(serie, 600, 140)

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/app/bors" className="page-sub" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>← Tilbake til screeneren</Link>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="swdot" style={{ background: SEKTOR_FARGE[aksje.sektor], width: 12, height: 12, flex: '0 0 12px' }} />
          {aksje.navn}
        </h1>
        <p className="page-sub">{aksje.ticker} · {marketNavn(aksje.marked)} · {aksje.bors} · {SEKTOR_NAVN[aksje.sektor] || aksje.sektor}</p>
      </div>

      {feil && <div className="import-feil" style={{ marginBottom: 16 }}>{feil}</div>}

      <div className="metrics">
        <div className="metric">
          <div className="k">Kurs</div>
          <div className="v">{rad?.harData ? `${rad.pris.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} ${rad.valuta || ''}` : '–'}</div>
          <div className="d">{rad?.dagEndringPst != null ? <span className={'bors-badge ' + (rad.dagEndringPst >= 0 ? 'opp' : 'ned')}>{formaterPst(rad.dagEndringPst, true)}</span> : 'i dag'}</div>
        </div>
        <div className="metric">
          <div className="k">Direkteavkastning</div>
          <div className="v">{rad?.direkteavkastning != null ? formaterPst(rad.direkteavkastning) : '–'}</div>
          <div className="d">Siste 12 mnd</div>
        </div>
        <div className="metric">
          <div className="k">52-ukers plassering</div>
          {rad?.rangePosisjon != null ? (
            <div className="bors-range" style={{ width: '100%', marginTop: 12 }}>
              <div className="bors-range-fyll" style={{ left: rad.rangePosisjon + '%' }} />
            </div>
          ) : <div className="v">–</div>}
          <div className="d">Lav → høy</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><h2>Kurshistorikk</h2><span className="hint">Siste 6 måneder</span></div>
        {punkter ? (
          <svg viewBox="0 0 600 140" style={{ width: '100%', height: 140, display: 'block' }} preserveAspectRatio="none">
            <polyline points={punkter} fill="none" stroke="var(--teal-deep)" strokeWidth="2" />
          </svg>
        ) : <div className="muted-note">Ingen historikk tilgjengelig ennå.</div>}
      </div>

      <div className="panel">
        <div className="panel-h"><h2>Siste nyheter</h2></div>
        {nyheter.length === 0 ? (
          <div className="muted-note">Ingen nyheter funnet for {aksje.navn} akkurat nå.</div>
        ) : (
          <div className="aksje-nyhetsliste">
            {nyheter.map((n) => (
              <a key={n.uuid} href={n.lenke} target="_blank" rel="noreferrer" className="aksje-nyhet">
                <div className="aksje-nyhet-tittel">{n.tittel}</div>
                <div className="aksje-nyhet-meta">{n.kilde} · {tidSiden(n.tid)}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
