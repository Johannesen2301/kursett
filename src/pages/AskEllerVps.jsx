import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SATSER, KILDER } from '../lib/skattekunnskap'
import { SISTE_AAR } from '../lib/skattekalkulator'
import Assistent from '../components/Assistent'
import Seo from '../components/Seo'

const FAQ = [
  {
    sporsmal: 'Hva er forskjellen på ASK og VPS?',
    svar: 'På vanlig aksjekonto (VPS) beskattes utbytte og gevinst løpende, samme år som du mottar dem. På aksjesparekonto (ASK) beskattes ingenting inne i kontoen — verken utbytte du reinvesterer eller gevinst ved salg av enkeltaksjer. Skatt utløses først når du tar ut mer penger enn du opprinnelig skjøt inn.',
  },
  {
    sporsmal: 'Hvilken er best for utbytteinvestering?',
    svar: 'For en langsiktig investor som reinvesterer utbytte, gir ASK som regel bedre sammensatt vekst, siden ingenting beskattes løpende inne i kontoen. På VPS beskattes hvert utbytte (utover skjermingsfradraget) samme år, som reduserer beløpet du har igjen å reinvestere.',
  },
  {
    sporsmal: 'Hvordan beregnes skjermingsfradraget forskjellig på ASK og VPS?',
    svar: 'På VPS beregnes skjermingen per aksje, basert på inngangsverdien (kostpris pluss kurtasje) for hver enkelt aksje. På ASK beregnes skjermingen samlet for hele kontoen, basert på laveste innskuddssaldo gjennom året — ikke beholdningsverdien.',
  },
  {
    sporsmal: 'Gjelder FIFU (først inn, først ut) på ASK?',
    svar: 'Nei. FIFU-prinsippet (at de eldste aksjene regnes som solgt først ved delsalg) er relevant på VPS, siden gevinst og kostpris beregnes per aksje. Inne i en ASK beskattes ikke enkeltsalg i det hele tatt — det er kun uttak fra selve kontoen som utløser skatt, uavhengig av hvilke aksjer du har solgt underveis.',
  },
]

export default function AskEllerVps() {
  const { user } = useAuth()

  return (
    <div className="kalk-side">
      <Seo
        tittel={`ASK eller VPS ${SISTE_AAR}? Forskjellen på aksjesparekonto og vanlig aksjekonto | Kursett`}
        beskrivelse="ASK eller vanlig aksjekonto (VPS) — hva er egentlig forskjellen på skatt, skjermingsfradrag og FIFU? Forklart med kilder fra Skatteetaten, og gratis kalkulator for begge."
        sti="/ask-eller-vps"
        faq={FAQ}
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

      <div className="page" style={{ maxWidth: 760, margin: '0 auto', padding: '10px 0 0' }}>
        <div className="page-head">
          <h1>ASK eller vanlig aksjekonto (VPS)?</h1>
          <p className="page-sub">Hovedforskjellen ligger i NÅR skatten inntreffer — ikke om du slipper unna den</p>
        </div>

        <div className="sk-disclaimer">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          <div>
            Dette er en <b>forklaring</b>, ikke skatterådgivning. Kontroller alltid mot{' '}
            <a href={KILDER.ask.url} target="_blank" rel="noreferrer">Skatteetaten</a>.
          </div>
        </div>

        <article className="sk-innhold" style={{ marginTop: 20 }}>
          <div className="sk-boks">
            <table className="sk-tabell sk-sammenlign">
              <thead>
                <tr>
                  <td className="sk-k"></td>
                  <td className="sk-v sk-ask" style={{ fontWeight: 700 }}>Aksjesparekonto (ASK)</td>
                  <td className="sk-v sk-vps" style={{ fontWeight: 700 }}>Vanlig konto (VPS)</td>
                </tr>
              </thead>
              <tbody>
                <tr><td className="sk-k">Utbytte</td><td className="sk-v sk-ask">Beskattes ikke løpende</td><td className="sk-v sk-vps">Beskattes samme år</td></tr>
                <tr><td className="sk-k">Gevinst ved salg</td><td className="sk-v sk-ask">Beskattes ikke inne i kontoen</td><td className="sk-v sk-vps">Beskattes ved salg</td></tr>
                <tr><td className="sk-k">Skatt utløses</td><td className="sk-v sk-ask">Ved uttak ut over innskutt kapital</td><td className="sk-v sk-vps">Løpende, år for år</td></tr>
                <tr><td className="sk-k">Skjerming beregnes</td><td className="sk-v sk-ask">Samlet for hele kontoen</td><td className="sk-v sk-vps">Per aksje</td></tr>
                <tr><td className="sk-k">FIFU ved salg</td><td className="sk-v sk-ask">Ikke relevant</td><td className="sk-v sk-vps">Gjelder</td></tr>
              </tbody>
            </table>
          </div>

          <p className="sk-tekst">
            For en langsiktig investor som reinvesterer utbytte, gir ASK som regel bedre sammensatt vekst, siden
            ingenting beskattes løpende inne i kontoen. Skatten utløses først når du tar ut mer enn du har skutt
            inn — ikke hvert år du mottar utbytte eller selger en aksje med gevinst.
          </p>

          <h2 className="sk-tittel" style={{ marginTop: 32 }}>Skjermingsfradraget virker forskjellig</h2>
          <p className="sk-tekst">
            Begge kontotypene har skjermingsfradrag — et årlig fradrag tilsvarende skjermingsrenten
            ({SATSER.skjermingsrente} for {SISTE_AAR}) ganget med grunnlaget ditt. Men grunnlaget beregnes helt
            ulikt:
          </p>
          <ul className="sk-liste">
            <li><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>
              <span><b>VPS:</b> skjermingsgrunnlaget er inngangsverdien (kostpris + kurtasje) for HVER enkelt aksje, pluss ubenyttet skjerming fra i fjor på akkurat den aksjen.</span></li>
            <li><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>
              <span><b>ASK:</b> skjermingsgrunnlaget er laveste innskuddssaldo gjennom hele året — ikke beholdningsverdien, og ikke summen av innskudd. Tar du ut penger, senker det grunnlaget for HELE året, selv om du satte pengene inn igjen senere.</span></li>
          </ul>

          <h2 className="sk-tittel" style={{ marginTop: 32 }}>FIFU gjelder kun på VPS</h2>
          <p className="sk-tekst">
            Selger du en del av en posisjon på vanlig konto, krever Skatteetaten at de eldste aksjene dine regnes
            som solgt først (FIFU — først inn, først ut), med sin egen faktiske kostpris. Har du kjøpt samme aksje
            på ulike tidspunkt til ulike priser, kan det gi et annet skattetall enn om du bare bruker et snitt.
            Inne i en ASK er dette irrelevant — det er kontoen som helhet som beskattes ved uttak, ikke det
            enkelte salget.
          </p>
        </article>

        <div className="kalk-funksjoner" style={{ marginTop: 36 }}>
          <h2>Regn ut ditt eget skjermingsfradrag — gratis, for begge kontotyper</h2>
          <p style={{ color: 'var(--sage)', marginTop: 12, fontSize: 14.5 }}>
            Kalkulatoren regner ut VPS, ASK og gevinst ved salg. Har du en portefølje å importere, gjør gratis
            konto det automatisk for alt du eier.
          </p>
          <Link to="/" className="btn kalk-funksjoner-cta">Åpne kalkulatoren</Link>
        </div>

        <div className="kalk-bunn">
          <div className="kalk-videre">
            <Link to="/skatteregler" className="kalk-kort">
              <b>Alle skattereglene</b>
              <span>Skjermingsfradrag, fallgruver og satser — med kilder fra Skatteetaten</span>
            </Link>
            <Link to="/login" className="kalk-kort">
              <b>Har du begge kontotyper?</b>
              <span>Importer VPS og ASK side om side, og se skatten for hele porteføljen automatisk</span>
            </Link>
          </div>
        </div>
      </div>

      <Assistent />
    </div>
  )
}
