import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hentBorsPriser } from '../lib/prices'
import { formaterPst } from '../lib/portfolio'

// Håndplukket, variert utvalg til forsiden — ikke ment å være representativt,
// bare vise at screeneren lever. Full liste (635 aksjer) ligger på /bors.
const UTVALG = [
  { navn: 'Equinor', ticker: 'EQNR.OL' },
  { navn: 'Apple', ticker: 'AAPL' },
  { navn: 'Nvidia', ticker: 'NVDA' },
  { navn: 'DNB Bank', ticker: 'DNB.OL' },
  { navn: 'Samsung Electronics', ticker: '005930.KS' },
  { navn: 'Mowi', ticker: 'MOWI.OL' },
]

export default function MarkedTeaser() {
  const [priser, setPriser] = useState({})

  useEffect(() => {
    let aktiv = true
    hentBorsPriser(UTVALG.map((u) => u.ticker))
      .then((data) => { if (aktiv) setPriser(data?.priser || {}) })
      .catch(() => {})
    return () => { aktiv = false }
  }, [])

  return (
    <div className="forside-marked">
      <div className="forside-marked-topp">
        <div>
          <div className="forside-marked-tittel">Markedet akkurat nå</div>
          <div className="forside-marked-sub">Et lite utdrag av aksjescreeneren</div>
        </div>
        <Link to="/bors" className="forside-marked-lenke">Se alle 635 aksjer →</Link>
      </div>
      <div className="forside-marked-grid">
        {UTVALG.map((u) => {
          const pd = priser[u.ticker]
          const endring = pd && !pd.feil ? pd.dagEndringPst : null
          return (
            <div className="forside-marked-kort" key={u.ticker}>
              <span>{u.navn}</span>
              {endring != null ? (
                <span className={'bors-badge ' + (endring >= 0 ? 'opp' : 'ned')}>{formaterPst(endring, true)}</span>
              ) : <span className="forside-marked-strek">–</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
