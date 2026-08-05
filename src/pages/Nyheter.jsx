import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { finnTicker } from '../lib/tickers'
import { hentNyheter, tidSiden, merkMedSelskap } from '../lib/nyheter'

export default function Nyheter() {
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')
  const [ingenPosisjoner, setIngenPosisjoner] = useState(false)
  const [nyheter, setNyheter] = useState([])

  useEffect(() => {
    let aktiv = true
    async function last() {
      setLaster(true); setFeil('')
      const { data: posisjoner, error } = await supabase.from('posisjoner').select('*')
      if (!aktiv) return
      if (error) { setFeil(error.message); setLaster(false); return }
      if (!posisjoner?.length) { setIngenPosisjoner(true); setLaster(false); return }

      const tickerTilNavn = {}
      for (const p of posisjoner) {
        const t = p.ticker || finnTicker(p.navn)
        if (t) tickerTilNavn[t] = p.navn
      }
      const tickers = Object.keys(tickerTilNavn)
      if (tickers.length === 0) { setIngenPosisjoner(true); setLaster(false); return }

      try {
        const data = await hentNyheter(tickers, tickerTilNavn)
        if (!aktiv) return
        setNyheter(merkMedSelskap(data?.nyheter || [], tickerTilNavn))
      } catch (err) {
        if (aktiv) setFeil('Fikk ikke hentet nyheter akkurat nå. (' + (err?.message || String(err)) + ')')
      } finally {
        if (aktiv) setLaster(false)
      }
    }
    last()
    return () => { aktiv = false }
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Nyheter</h1>
        <p className="page-sub">Nyheter om aksjene du eier</p>
      </div>

      {feil && <div className="import-feil">{feil}</div>}

      {laster ? (
        <div className="muted-note">Laster …</div>
      ) : ingenPosisjoner ? (
        <div className="panel">
          <div className="muted-note">Importer porteføljen din for å se nyheter om aksjene dine.</div>
          <Link to="/app/portefolje" className="btn ghost" style={{ marginTop: 14 }}>Til porteføljen</Link>
        </div>
      ) : nyheter.length === 0 ? (
        <div className="panel"><div className="muted-note">Ingen nyheter funnet for aksjene dine akkurat nå.</div></div>
      ) : (
        <div className="panel">
          <div className="aksje-nyhetsliste">
            {nyheter.map((n) => (
              <a key={n.uuid} href={n.lenke} target="_blank" rel="noreferrer" className="aksje-nyhet">
                <div className="aksje-nyhet-tittel">{n.tittel}</div>
                <div className="aksje-nyhet-meta">
                  {n.gjelderNavn?.length > 0 && <span className="nyhet-gjelder">{n.gjelderNavn.join(', ')}</span>}
                  {n.kilde} · {tidSiden(n.tid)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
