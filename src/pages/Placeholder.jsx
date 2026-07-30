import { Link } from 'react-router-dom'

// Pro-funksjoner som ikke er lansert ennå. Ingen internt "lag"-språk.
const INNHOLD = {
  skatt: {
    tittel: 'Min skatt',
    ingress: 'Skattemotoren kommer snart',
    tekst:
      'Se skjermingsgrunnlaget ditt per aksje, hvor mye ubenyttet skjerming du har spart opp, og hva du sannsynligvis skylder — regnet ut fra porteføljen du allerede har importert.',
    punkter: [
      'Skjermingsfradrag per aksje, med fremføring',
      'ASK og VPS behandlet riktig',
      'Varsel før du selger og brenner opp oppspart skjerming',
    ],
    ikon: 'M9 7h6M9 12h6M9 17h4M5 3h14v18H5z',
  },
  radgiver: {
    tittel: 'Rådgiver',
    ingress: 'AI-rådgiveren kommer snart',
    tekst:
      'Still spørsmål om dine egne tall og få dem forklart. Rådgiveren forklarer konsekvensene av porteføljen din — den gir aldri kjøps- eller salgsanbefalinger.',
    punkter: [
      'Forklarer sammensetningen og risikoen din',
      'Svarer på skattespørsmål om dine egne posisjoner',
      'Forklarer, anbefaler ikke',
    ],
    ikon: 'M12 3a5 5 0 0 1 5 5c0 2-1 3-1 5H8c0-2-1-3-1-5a5 5 0 0 1 5-5ZM9 18h6M10 21h4',
  },
}

export default function Placeholder({ side }) {
  const d = INNHOLD[side] || INNHOLD.skatt

  return (
    <div className="page">
      <div className="page-head">
        <h1>{d.tittel}<span className="pro-pill">PRO</span></h1>
        <p className="page-sub">Ikke lansert ennå</p>
      </div>

      <div className="snart-kort">
        <div className="snart-ikon">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d={d.ikon} /></svg>
        </div>
        <h2>{d.ingress}</h2>
        <p className="snart-tekst">{d.tekst}</p>

        <ul className="snart-liste">
          {d.punkter.map((p, i) => (
            <li key={i}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="snart-fot">
          Alt annet i Kursett er gratis og klart til bruk.
          {' '}<Link to="/skatteregler">Les skattereglene her</Link> mens du venter.
        </div>
      </div>
    </div>
  )
}
