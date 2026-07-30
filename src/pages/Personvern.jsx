import { useState } from 'react'

const OPPDATERT = '13. juli 2026'

export default function Personvern() {
  const [fane, setFane] = useState('personvern')

  return (
    <div className="page">
      <div className="page-head">
        <h1>{fane === 'personvern' ? 'Personvern' : 'Brukervilkår'}</h1>
        <p className="page-sub">Sist oppdatert {OPPDATERT}</p>
      </div>

      <div className="jur-faner">
        <button className={'jur-fane' + (fane === 'personvern' ? ' on' : '')} onClick={() => setFane('personvern')}>
          Personvernerklæring
        </button>
        <button className={'jur-fane' + (fane === 'vilkar' ? ' on' : '')} onClick={() => setFane('vilkar')}>
          Brukervilkår
        </button>
      </div>

      <article className="jur">
        {fane === 'personvern' ? (
          <>
            <p className="jur-ingress">
              Kursett lagrer data om deg for å kunne vise porteføljen din og la deg delta i
              fellesskapet. Her står nøyaktig hva vi lagrer, hvorfor, og hvordan du blir kvitt det.
            </p>

            <h2>Hvem er ansvarlig</h2>
            <p>
              Kursett drives av Johannes Johannesen, Egersund. Jeg er behandlingsansvarlig for
              opplysningene dine. Spørsmål? Ta kontakt via e-postadressen nederst.
            </p>

            <h2>Hva vi lagrer</h2>
            <table className="jur-tabell">
              <tbody>
                <tr>
                  <td className="jt-k">E-postadresse</td>
                  <td>For å opprette konto og logge deg inn.</td>
                </tr>
                <tr>
                  <td className="jt-k">Porteføljedata</td>
                  <td>
                    Aksjenavn, antall, markedsverdi og kostpris fra CSV-en du importerer fra
                    Nordnet. Brukes til å vise porteføljen din og regne ut nøkkeltall.
                  </td>
                </tr>
                <tr>
                  <td className="jt-k">Profil</td>
                  <td>Brukernavn, bio og avatarfarge — det du selv legger inn.</td>
                </tr>
                <tr>
                  <td className="jt-k">Sosialt innhold</td>
                  <td>Meldinger, forumsvar, hvem du følger og er venn med.</td>
                </tr>
              </tbody>
            </table>

            <h2>Hva andre kan se</h2>
            <p>
              Sammensetningen din vises <b>alltid kun i prosent</b> — aldri kronebeløp, aldri antall
              aksjer, aldri porteføljeverdi. Om andre kan se <i>hvilke</i> aksjer du eier, styrer du
              selv med bryteren under Profil. Den er av som standard.
            </p>
            <p>
              Dette er håndhevet i databasen, ikke bare i grensesnittet. Kronebeløpene dine er ikke
              tilgjengelige for andre brukere, uansett.
            </p>

            <h2>Hvem vi deler med</h2>
            <p>
              Vi selger ikke data, og vi bruker ikke data til annonser. Vi bruker to
              underleverandører for å drifte tjenesten:
            </p>
            <ul className="jur-liste">
              <li><b>Supabase</b> — database og innlogging (EU-region)</li>
              <li><b>Netlify</b> — hosting av nettsiden</li>
            </ul>
            <p>
              Kursdata hentes fra Yahoo Finance. Vi sender aldri dine personopplysninger dit — kun
              aksjeticker (f.eks. «EQNR.OL»), som ikke kan knyttes til deg.
            </p>

            <h2>Hvor lenge</h2>
            <p>
              Så lenge du har konto. Sletter du kontoen, slettes alt: portefølje, profil, meldinger,
              vennskap. Det skjer umiddelbart og kan ikke angres.
            </p>

            <h2>Rettighetene dine</h2>
            <p>
              Du kan når som helst se, endre eller slette opplysningene dine. «Slett konto» finner du
              under Profil. Du har også rett til innsyn, retting og dataportabilitet etter GDPR — ta
              kontakt, så ordner jeg det.
            </p>
            <p>
              Mener du at noe håndteres feil, kan du klage til Datatilsynet.
            </p>

            <h2>Informasjonskapsler</h2>
            <p>
              Kursett bruker kun det som er nødvendig for at innlogging skal fungere. Ingen
              sporing, ingen annonsecookies, ingen tredjeparts analyse.
            </p>

            <div className="jur-kontakt">
              Spørsmål om personvern? Send e-post til <b>johannesjohannesen7@gmail.com</b>
            </div>
          </>
        ) : (
          <>
            <p className="jur-ingress">
              Kort oppsummert: Kursett er et verktøy for å se porteføljen din og diskutere
              investering med andre. Det er ikke rådgivning, og du er selv ansvarlig for
              beslutningene dine.
            </p>

            <h2>Kursett er et verktøy, ikke rådgivning</h2>
            <p>
              Alt du ser i Kursett — nøkkeltall, skatteberegninger, forklaringer — er informasjon,
              ikke investeringsrådgivning eller skatterådgivning. Vi anbefaler ikke kjøp eller salg.
            </p>
            <p>
              Skatteberegninger er et hjelpemiddel. <b>Du er selv ansvarlig for skattemeldingen
              din.</b> Kontroller alltid tallene mot Skatteetaten. Vi tar forbehold om feil.
            </p>

            <h2>Dine data er ditt ansvar</h2>
            <p>
              Porteføljen bygger på CSV-en du selv importerer. Er dataene feil eller utdaterte, blir
              tallene det også. Kursdata hentes fra en tredjepart og kan være forsinket eller
              mangelfull.
            </p>

            <h2>Regler i fellesskapet</h2>
            <p>Rom, forum og meldinger er for diskusjon og analyse. Dette er ikke tillatt:</p>
            <ul className="jur-liste">
              <li>
                <b>Betalte kjøps- eller salgssignaler.</b> Å selge tilgang til sanntidsanbefalinger
                kan utgjøre ukonsesjonert investeringsrådgivning eller markedsmanipulasjon. Det er
                forbudt på Kursett.
              </li>
              <li>Kursmanipulasjon, villedende informasjon eller innsideinformasjon</li>
              <li>Spam, reklame eller uønsket markedsføring</li>
              <li>Trakassering, hets eller trusler</li>
              <li>Deling av andres personopplysninger</li>
            </ul>
            <p>
              Brudd kan føre til at innhold fjernes og at kontoen stenges. Du kan rapportere innhold
              med flagg-ikonet, og blokkere brukere du ikke vil høre fra.
            </p>

            <h2>Tjenesten kan endres</h2>
            <p>
              Kursett er under utvikling. Funksjoner kan endres eller forsvinne, og det kan oppstå
              feil og nedetid. Tjenesten leveres «som den er», uten garantier.
            </p>

            <h2>Ansvarsbegrensning</h2>
            <p>
              Kursett er ikke ansvarlig for økonomiske tap som følge av beslutninger du tar basert på
              informasjon i tjenesten, feil i data, eller nedetid. Du investerer på eget ansvar.
            </p>

            <h2>Oppsigelse</h2>
            <p>
              Du kan slette kontoen din når som helst under Profil. Da fjernes alle dataene dine.
            </p>

            <div className="jur-kontakt">
              Spørsmål? Send e-post til <b>johannesjohannesen7@gmail.com</b>
            </div>
          </>
        )}
      </article>
    </div>
  )
}
