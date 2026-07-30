import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentPriser } from '../lib/prices'
import { beregnPortefolje, formaterKr, formaterPst } from '../lib/portfolio'
import { beregnVPSPortefolje, hentSkjermingRader } from '../lib/skattemotor'
import { kr, krDes, SISTE_AAR } from '../lib/skattekalkulator'
import { SKATTEKUNNSKAP, OM_KURSETT } from '../lib/kunnskapsgrunnlag'

const ASK_NOEKKEL = '__ASK__'

// Assistenten (edge-funksjonen) er skrevet defensivt for en generell widget uten
// porteføljekontekst. Her på Rådgiver-siden — som eksplisitt skal forklare
// sammensetning og risiko i brukerens EGEN portefølje — utvider vi rammene litt,
// uten å røre den delte edge-funksjonen: vi presiserer i grunnlaget at forklaring
// (ikke anbefaling) av konsentrasjon/sektor/valuta-risiko er innafor oppgaven.
const RADGIVER_MODUS = `Du er nå på Rådgiver-siden i Kursett — en side dedikert til å forklare brukerens
EGEN portefølje og skattetall, ikke bare generelle regler. Her er det eksplisitt innenfor oppgaven din å:
- Forklare sammensetning, konsentrasjon og vekting i porteføljen (f.eks. hvorfor én sektor eller aksje
  utgjør en stor andel, og hva det generelt betyr for risiko — konsentrasjonsrisiko, sektorrisiko, valutarisiko).
- Peke på hvilke av brukerens aksjer som har mest/minst ubenyttet skjerming, høyest skatt, osv. — basert på
  tallene under.
- Forklare hva som skjer skattemessig HVIS brukeren selger en posisjon i dag, basert på hypotese-tallene
  under (gevinst/tap etter skjerming, og hvor mye skjerming som eventuelt bortfaller). Dette er å FORKLARE
  en konsekvens av et scenario brukeren spør om — ikke det samme som å anbefale salg.
Fortsatt gjelder de absolutte reglene fra kunnskapsgrunnlaget: du sier ALDRI hva brukeren bør kjøpe, selge,
beholde, eller om en aksje er "god" eller "dårlig". Du beskriver hva som ER i porteføljen og hvorfor, ikke
hva brukeren bør gjøre med det. Har brukeren ingen egne tall under, forklar generelt i stedet.`

// Enkel markdown → HTML-elementer. Kun fet skrift og punktlister. Delt logikk
// med Assistent.jsx (bevisst duplisert — begge er små og uavhengige).
function formater(tekst) {
  const linjer = String(tekst).split('\n')
  return linjer.map((linje, i) => {
    const overskrift = /^\s{0,3}#{1,4}\s+(.*)$/.exec(linje)
    if (overskrift) return <div key={i} className="ass-overskrift">{overskrift[1]}</div>

    const punkt = /^\s*[-*•]\s+(.*)$/.exec(linje)
    const innhold = punkt ? punkt[1] : linje
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

// Bygger en tekstoppsummering av brukerens EGNE tall — hentet fra nøyaktig
// samme beregning som Min skatt viser, slik at rådgiveren aldri regner egne
// tall selv, bare forklarer det som allerede er regnet ut.
function byggPersonligGrunnlag({ pf, rader, askUbenyttet }) {
  if (!pf || pf.antall === 0) return null

  const linjer = []
  linjer.push(`Brukeren er innlogget og har importert en portefølje med ${pf.antall} posisjon(er), samlet verdi ${formaterKr(pf.total)}.`)
  if (pf.sektorer.length > 0) {
    linjer.push('Sektorsammensetning: ' + pf.sektorer.map((s) => `${s.navn} ${s.vekt.toFixed(0)}%`).join(', ') + '.')
  }
  linjer.push('Beholdning (navn, antall, markedsverdi, vekt): ' +
    pf.posisjoner.map((p) => `${p.navn} (${p.antall ?? '?'} stk, ${formaterKr(p.liveVerdi)}, ${p.vekt.toFixed(1)}%)`).join('; ') + '.')
  if (pf.gevinst != null) {
    linjer.push(`Urealisert gevinst/tap totalt: ${formaterKr(pf.gevinst)} (${formaterPst(pf.gevinstPst, true)}).`)
  }

  if (rader.length > 0) {
    linjer.push(`\nSkjermingsfradrag ${SISTE_AAR} — regnet ut av Skattemotoren (Min skatt), per VPS-aksje:`)
    for (const x of rader) {
      linjer.push(
        `- ${x.navn}: kostpris ${kr(x.r.inngangsverdi)}, skjermingsgrunnlag ${kr(x.r.grunnlag)}, ` +
        `skjermingsfradrag ${krDes(x.r.skjerming)}, utbytte mottatt ${kr(x.r.utbytte)}, ` +
        `skattepliktig ${krDes(x.r.skattepliktig)}, skatt ${krDes(x.r.skatt)}` +
        (x.r.nyUbenyttet > 0 ? `, ubenyttet skjerming videre til ${SISTE_AAR + 1}: ${kr(x.r.nyUbenyttet)}` : '')
      )
    }
    const tot = rader.reduce((s, x) => ({
      skjerming: s.skjerming + x.r.skjerming, skatt: s.skatt + x.r.skatt, spart: s.spart + x.r.spart,
    }), { skjerming: 0, skatt: 0, spart: 0 })
    linjer.push(`Totalt for VPS: skjermingsfradrag ${krDes(tot.skjerming)}, skatt ${krDes(tot.skatt)}, spart takket være skjerming ${krDes(tot.spart)}.`)

    const medSalgsdata = rader.filter((x) => x.g)
    if (medSalgsdata.length > 0) {
      linjer.push(`\nHypotetisk «hvis brukeren selger i dag» (Min skatt) — MERK: skjerming brukt her er et ALTERNATIV til` +
        ` skjermingen brukt mot utbytte over, ikke i tillegg. Selger man, bortfaller ubrukt skjerming (fremføres ikke):`)
      for (const x of medSalgsdata) {
        linjer.push(
          `- ${x.navn}: verdi nå ${kr(x.verdiNaa)}${!x.harLivePris ? ' (fra siste import, ikke live)' : ''}, ` +
          (x.g.erGevinst
            ? `gevinst før skjerming ${kr(x.g.gevinstFoerSkjerming)}, skattepliktig etter skjerming ${krDes(x.g.skattepliktig)}, skatt ${krDes(x.g.skatt)}`
            : `tap ${kr(x.g.tap)} (skjerming brukes ikke ved tap)`) +
          (x.g.bortfaltSkjerming > 0 ? `, ${krDes(x.g.bortfaltSkjerming)} skjerming ville gått tapt ved salg` : '')
        )
      }
    }
  } else {
    linjer.push('Ingen av posisjonene har nok data (mangler GAV) til at skjermingsfradrag er beregnet ennå.')
  }

  if (askUbenyttet != null) {
    linjer.push(`Brukeren har også en aksjesparekonto (ASK) med ${kr(askUbenyttet)} i ubenyttet skjerming fremført fra tidligere lagring. Årets ASK-tall (laveste innskuddssaldo, uttak) er ikke tilgjengelig her — det regnes ut i Min skatt-fanen for ASK, og brukeren må laste opp et kontoutdrag der for et ferskt tall.`)
  }

  linjer.push(`\nAlle disse tallene er allerede beregnet av Skattemotoren i Kursett — ikke regn dem om selv, bare forklar og referer til dem. Utbytte er hentet fra faktisk utbetalingshistorikk og kan være ufullstendig hvis det er lenge siden årsskiftet — nevn dette hvis relevant.`)

  return linjer.join('\n')
}

const FORSLAG = [
  'Hvorfor er den største posisjonen min så høyt vektet?',
  'Hvilken aksje har jeg mest ubenyttet skjerming på?',
  'Hvor mye betaler jeg i skatt på utbyttet mitt totalt?',
  'Hvor mye skjerming går tapt hvis jeg selger nå?',
]

export default function Radgiver() {
  const [posisjoner, setPosisjoner] = useState([])
  const [prisdata, setPrisdata] = useState(null)
  const [skjermingRader, setSkjermingRader] = useState([])
  const [laster, setLaster] = useState(true)

  const [meldinger, setMeldinger] = useState([])
  const [tekst, setTekst] = useState('')
  const [venter, setVenter] = useState(false)
  const [feil, setFeil] = useState('')
  const [grense, setGrense] = useState(false)
  const enden = useRef(null)

  useEffect(() => { enden.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger, venter])

  useEffect(() => {
    let avbrutt = false
    async function last() {
      setLaster(true); setFeil('')
      const { data: pos, error: posFeil } = await supabase
        .from('posisjoner').select('*').order('markedsverdi', { ascending: false })
      if (avbrutt) return
      if (posFeil) { setFeil('Fikk ikke hentet porteføljen (' + posFeil.message + ')'); setLaster(false); return }
      setPosisjoner(pos || [])
      hentSkjermingRader(supabase).then((r) => { if (!avbrutt) setSkjermingRader(r) }).catch(() => {})
      if (pos && pos.length > 0) {
        const priser = await hentPriser(pos).catch(() => null)
        if (!avbrutt) setPrisdata(priser)
      }
      if (!avbrutt) setLaster(false)
    }
    last()
    return () => { avbrutt = true }
  }, [])

  const pf = useMemo(() => (posisjoner.length > 0 ? beregnPortefolje(posisjoner, prisdata) : null), [posisjoner, prisdata])
  const { rader } = useMemo(
    () => beregnVPSPortefolje({ posisjoner, prisdata, skjermingRader }),
    [posisjoner, prisdata, skjermingRader]
  )
  const askUbenyttet = useMemo(() => {
    const rad = skjermingRader.find((r) => r.noekkel === ASK_NOEKKEL)
    return rad && rad.aar === SISTE_AAR ? Number(rad.ubenyttet) || 0 : null
  }, [skjermingRader])

  const personligGrunnlag = useMemo(
    () => byggPersonligGrunnlag({ pf, rader, askUbenyttet }),
    [pf, rader, askUbenyttet]
  )

  async function send(sporsmal) {
    const q = (sporsmal ?? tekst).trim()
    if (!q || venter) return

    setFeil('')
    setTekst('')
    const nye = [...meldinger, { rolle: 'bruker', tekst: q }]
    setMeldinger(nye)
    setVenter(true)

    const grunnlag = SKATTEKUNNSKAP + '\n\n' + OM_KURSETT + '\n\n' + RADGIVER_MODUS +
      (personligGrunnlag ? '\n\n=== BRUKERENS EGNE TALL ===\n' + personligGrunnlag : '')

    try {
      const { data, error } = await supabase.functions.invoke('assistent', {
        body: { melding: q, historikk: meldinger, grunnlag },
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

  return (
    <div className="page radg-side">
      <div className="page-head">
        <h1>Rådgiver</h1>
        <p className="page-sub">
          {laster ? 'Laster porteføljen din …' : pf
            ? `Svarer med utgangspunkt i dine ${pf.antall} posisjoner og skattetallene fra Min skatt`
            : 'Svarer på generelle skattespørsmål — importer porteføljen din for personlige svar'}
        </p>
      </div>

      <div className="panel radg-chat">
        <div className="ass-body radg-body">
          {meldinger.length === 0 && (
            <div className="ass-velkomst">
              <p>
                Jeg forklarer sammensetningen og skattetallene dine — jeg gir aldri kjøps- eller
                salgsanbefalinger.
              </p>
              <div className="ass-forslag">
                {FORSLAG.map((f) => (
                  <button key={f} onClick={() => send(f)} disabled={laster}>{f}</button>
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
              <p>Rådgiveren har en grense på noen spørsmål i timen for å holde driftskostnadene nede.</p>
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
            placeholder={grense ? 'Kom tilbake om en time' : 'Spør om porteføljen eller skatten din …'}
            maxLength={1000}
            disabled={grense || laster}
          />
          <button disabled={venter || grense || laster || !tekst.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        </form>

        <div className="ass-bunn">
          Rådgiveren forklarer konsekvensene av porteføljen din — den anbefaler aldri kjøp eller salg,
          og er ikke skatterådgivning. Kontroller alltid mot Skatteetaten.
        </div>
      </div>
    </div>
  )
}
