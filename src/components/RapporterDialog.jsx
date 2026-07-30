import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { rapporter, blokker, RAPPORT_GRUNNER } from '../lib/moderering'

export default function RapporterDialog({ mål, onLukk, onBlokkert }) {
  const { user } = useAuth()
  const [grunn, setGrunn] = useState(RAPPORT_GRUNNER[0])
  const [ogsaBlokker, setOgsaBlokker] = useState(false)
  const [jobber, setJobber] = useState(false)
  const [ferdig, setFerdig] = useState(false)
  const [feil, setFeil] = useState('')

  async function send() {
    setJobber(true); setFeil('')
    try {
      await rapporter(user.id, {
        meldtBrukerId: mål.brukerId,
        type: mål.type,
        innholdId: mål.innholdId,
        innholdTekst: mål.tekst,
        begrunnelse: grunn,
      })
      if (ogsaBlokker && mål.brukerId) {
        await blokker(user.id, mål.brukerId)
        onBlokkert?.(mål.brukerId)
      }
      setFerdig(true)
    } catch (e) {
      setFeil(e.message)
    } finally {
      setJobber(false)
    }
  }

  return (
    <div className="mod-overlay" onClick={(e) => { if (e.target.className === 'mod-overlay') onLukk() }}>
      <div className="mod-dialog">
        {ferdig ? (
          <>
            <div className="mod-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h3>Takk for rapporten</h3>
            <p className="mod-tekst">
              Vi ser på den så snart vi kan.{ogsaBlokker && ' Brukeren er også blokkert.'}
            </p>
            <button className="btn" onClick={onLukk}>Lukk</button>
          </>
        ) : (
          <>
            <h3>Rapporter{mål.navn ? ` ${mål.navn}` : ''}</h3>
            {mål.tekst && <div className="mod-sitat">«{mål.tekst}»</div>}

            <div className="mod-grunner">
              {RAPPORT_GRUNNER.map((g) => (
                <label key={g} className={'mod-grunn' + (grunn === g ? ' valgt' : '')}>
                  <input type="radio" name="grunn" checked={grunn === g} onChange={() => setGrunn(g)} />
                  <span>{g}</span>
                </label>
              ))}
            </div>

            {mål.brukerId && (
              <label className="mod-blokker">
                <input type="checkbox" checked={ogsaBlokker} onChange={(e) => setOgsaBlokker(e.target.checked)} />
                <span>Blokker også denne brukeren — da kan de ikke sende deg meldinger eller venneforespørsler</span>
              </label>
            )}

            {feil && <div className="import-feil" style={{ marginTop: 14 }}>{feil}</div>}

            <div className="mod-knapper">
              <button className="btn ghost" onClick={onLukk} disabled={jobber}>Avbryt</button>
              <button className="btn" onClick={send} disabled={jobber}>
                {jobber ? 'Sender …' : 'Send rapport'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
