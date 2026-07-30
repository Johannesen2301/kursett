import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SKATTEKUNNSKAP, OM_KURSETT } from '../lib/kunnskapsgrunnlag'

// Enkel markdown → HTML-elementer. Kun fet skrift og punktlister.
function formater(tekst) {
  const linjer = String(tekst).split('\n')
  return linjer.map((linje, i) => {
    const overskrift = /^\s{0,3}#{1,4}\s+(.*)$/.exec(linje)
    if (overskrift) return <div key={i} className="ass-overskrift">{overskrift[1]}</div>

    const punkt = /^\s*[-*•]\s+(.*)$/.exec(linje)
    const innhold = punkt ? punkt[1] : linje

    // Del opp på **fet**
    const deler = innhold.split(/(\*\*[^*]+\*\*)/g).map((d, j) =>
      d.startsWith('**') && d.endsWith('**')
        ? <b key={j}>{d.slice(2, -2)}</b>
        : <span key={j}>{d}</span>
    )

    if (punkt) return <div key={i} className="ass-punkt">{deler}</div>
    if (linje.trim() === '') return <div key={i} className="ass-luft" />
    return <div key={i}>{deler}</div>
  })
}

const FORSLAG = [
  'Hva er skjermingsfradrag?',
  'Hva er forskjellen på ASK og VPS?',
  'Hvordan importerer jeg fra Nordnet?',
  'Hva skjer med skjermingen hvis jeg selger med tap?',
]

export default function Assistent() {
  const [aapen, setAapen] = useState(false)
  const [meldinger, setMeldinger] = useState([])
  const [tekst, setTekst] = useState('')
  const [venter, setVenter] = useState(false)
  const [feil, setFeil] = useState('')
  const [grense, setGrense] = useState(false)
  const enden = useRef(null)

  useEffect(() => { enden.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger, venter])

  async function send(sporsmal) {
    const q = (sporsmal ?? tekst).trim()
    if (!q || venter) return

    setFeil('')
    setTekst('')
    const nye = [...meldinger, { rolle: 'bruker', tekst: q }]
    setMeldinger(nye)
    setVenter(true)

    try {
      const { data, error } = await supabase.functions.invoke('assistent', {
        body: {
          melding: q,
          historikk: meldinger,
          grunnlag: SKATTEKUNNSKAP + '\n\n' + OM_KURSETT,
        },
      })
      if (error) throw error
      if (data?.proGrense) { setGrense(true); setVenter(false); return }
      if (data?.feil) throw new Error(data.feil)
      setMeldinger([...nye, { rolle: 'assistent', tekst: data.svar }])
    } catch (e) {
      setFeil(e.message || 'Noe gikk galt. Prøv igjen.')
    } finally {
      setVenter(false)
    }
  }

  if (!aapen) {
    return (
      <button className="ass-knapp" onClick={() => setAapen(true)} aria-label="Spør om skatt">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Spør om skatt</span>
      </button>
    )
  }

  return (
    <div className="ass-panel">
      <div className="ass-topp">
        <div>
          <div className="ass-navn">Kursett-assistenten</div>
          <div className="ass-under">Svarer på norsk aksjeskatt</div>
        </div>
        <button className="ass-lukk" onClick={() => setAapen(false)} aria-label="Lukk">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="ass-body">
        {meldinger.length === 0 && (
          <div className="ass-velkomst">
            <p>Jeg svarer på spørsmål om norsk aksjeskatt og hvordan du bruker Kursett.</p>
            <div className="ass-forslag">
              {FORSLAG.map((f) => (
                <button key={f} onClick={() => send(f)}>{f}</button>
              ))}
            </div>
          </div>
        )}

        {meldinger.map((m, i) => (
          <div key={i} className={'ass-melding' + (m.rolle === 'bruker' ? ' egen' : '')}>
            <div className="ass-boble">{m.rolle === 'assistent' ? formater(m.tekst) : m.tekst}</div>
          </div>
        ))}

        {venter && (
          <div className="ass-melding">
            <div className="ass-boble ass-skriver"><span /><span /><span /></div>
          </div>
        )}

        {grense && (
          <div className="ass-pro">
            <div className="ass-pro-tittel">Du har brukt opp spørsmålene for denne timen</div>
            <p>Assistenten har en grense på noen spørsmål i timen for å holde driftskostnadene nede.</p>
            <div className="ass-pro-fot">Kom tilbake om en time — det er fortsatt helt gratis.</div>
          </div>
        )}

        {feil && <div className="ass-feil">{feil}</div>}
        <div ref={enden} />
      </div>

      <form className="ass-input" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={grense ? "Kom tilbake om en time" : "Spør om skjermingsfradrag, ASK, VPS …"}
          maxLength={1000}
          disabled={grense}
        />
        <button disabled={venter || grense || !tekst.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </form>

      <div className="ass-bunn">
        Assistenten svarer kun fra verifiserte kilder. Den gir ikke investerings-
        eller skatterådgivning — kontroller alltid mot Skatteetaten.
      </div>
    </div>
  )
}
