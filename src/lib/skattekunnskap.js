// Norsk aksjeskatt — verifisert kunnskapsgrunnlag.
// Kilder: Skatteetaten, lovforarbeidene (Ot.prp. om aksjonærmodellen), Finansavisen.
// ALT innhold her skal være etterprøvbart. Ikke legg til noe som ikke er verifisert.

// Offisielle kilder — brukeren kan verifisere alt selv.
export const KILDER = {
  // Kun lenker som er bekreftet å virke. Søkelenker der vi er usikre —
  // de kan ikke bli utdaterte selv om Skatteetaten flytter sidene sine.
  skjermingsrente: {
    tekst: 'Skjermingsrente for aksjer (offisiell sats)',
    url: 'https://www.skatteetaten.no/satser/skjermingsrente-for-aksjer-og-enkeltpersonforetak/',
  },
  ask: {
    tekst: 'Søk hos Skatteetaten: aksjesparekonto',
    url: 'https://www.skatteetaten.no/sok/?q=aksjesparekonto+skjermingsgrunnlag',
  },
  skjerming: {
    tekst: 'Søk hos Skatteetaten: skjermingsfradrag',
    url: 'https://www.skatteetaten.no/sok/?q=skjermingsfradrag',
  },
  oppjustering: {
    tekst: 'Søk hos Skatteetaten: oppjusteringsfaktor',
    url: 'https://www.skatteetaten.no/sok/?q=oppjusteringsfaktor+aksjer',
  },
  aksjer: {
    tekst: 'Skatteetaten: aksjer og verdipapirer',
    url: 'https://www.skatteetaten.no/sok/?q=aksjer+og+verdipapirer',
  },
}

export const SATSER = {
  skjermingsrente: '3,6 %',
  skjermingsrenteAar: '2025',
  oppjusteringsfaktor: '1,72',
  effektivSats: '37,84 %',
  alminneligInntekt: '22 %',
}

export const TEMAER = [
  {
    id: 'grunnleggende',
    kilder: ['skjerming', 'aksjer'],
    tittel: 'Hva er skjermingsfradraget?',
    ingress:
      'Et årlig frikort på utbytte og gevinst. Den delen av avkastningen din som tilsvarer risikofri rente, slipper du skatt på.',
    innhold: [
      {
        type: 'tekst',
        tekst:
          'Skjermingsfradraget beregnes ved å gange skjermingsgrunnlaget med skjermingsrenten. Får du mindre utbytte enn skjermingen, forsvinner ikke resten — den fremføres til senere år.',
      },
      {
        type: 'formel',
        tittel: 'Grunnformelen',
        rader: [
          ['Skjermingsfradrag', 'skjermingsgrunnlag × skjermingsrente'],
        ],
      },
      {
        type: 'eksempel',
        tittel: 'Enkelt eksempel',
        rader: [
          ['Kostpris + kurtasje', '10 000 + 100 = 10 100 kr'],
          ['Skjermingsrente (1 %)', '101 kr i skjerming'],
          ['Utbytte mottatt', '500 kr'],
          ['Skattepliktig utbytte', '500 − 101 = 399 kr'],
        ],
      },
    ],
  },

  {
    id: 'grunnlag',
    kilder: ['skjerming', 'ask'],
    tittel: 'Skjermingsgrunnlaget — VPS vs ASK',
    ingress:
      'Grunnlaget beregnes helt ulikt på vanlig aksjekonto (VPS) og aksjesparekonto (ASK). Dette forveksles ofte.',
    innhold: [
      {
        type: 'formel',
        tittel: 'VPS / enkeltaksje',
        rader: [
          ['Skjermingsgrunnlag', 'inngangsverdi (kostpris + kurtasje) + ubenyttet skjerming'],
        ],
      },
      {
        type: 'formel',
        tittel: 'Aksjesparekonto (ASK)',
        rader: [
          ['Skjermingsgrunnlag', 'laveste innskuddssaldo i året + ubenyttet skjerming'],
        ],
      },
      {
        type: 'kildehenvisning',
        tekst:
          'Skatteetaten: «Skjermingsgrunnlaget fastsettes til den laveste innskuddssaldoen på kontoen i løpet av inntektsåret, tillagt ubenyttet skjerming fra tidligere år, jf. sktl. § 10-21 femte ledd femte punktum.»',
      },
      {
        type: 'tekst',
        tekst:
          'På ASK beregnes skjermingen på hele kontoen samlet — ikke per aksje, og uten FIFU. Grunnlaget er den laveste innskuddssaldoen gjennom året. Merk: dette betyr laveste nivå på samlet innskutt kapital, ikke det minste enkeltinnskuddet. Det er uttak som senker grunnlaget — ikke sene innskudd.',
      },
    ],
  },

  {
    id: 'fallgruver',
    kilder: ['skjerming', 'ask'],
    tittel: 'Fem fallgruver',
    ingress:
      'Dette er punktene der selv erfarne investorer regner feil — og der det koster ekte penger.',
    innhold: [
      {
        type: 'fallgruve',
        nr: 1,
        tittel: 'Ubenyttet skjerming ØKER grunnlaget',
        tekst:
          'Ubenyttet skjerming er ikke bare et fradrag som ligger på siden — den legges til skjermingsgrunnlaget på samme aksje neste år. Det gir en ekte rentes-rente-effekt.',
        kilde:
          'Skatteetaten: «Ubenyttet skjerming legges til skjermingsgrunnlaget, og kan fremføres til fradrag i senere års uttak og utbytter, jf. sktl. § 10-21 femte ledd tredje punktum.» Dette gir en rentes-rente-effekt.',
        eksempel: [
          ['Grunnlag år 1', '10 100 kr'],
          ['Skjerming (1 %)', '101 kr'],
          ['Utbytte tatt ut', '50 kr'],
          ['Ubenyttet skjerming', '51 kr'],
          ['Nytt grunnlag år 2', '10 151 kr'],
        ],
      },
      {
        type: 'fallgruve',
        nr: 2,
        tittel: 'VPS: skjermingen følger den enkelte aksjen. ASK: ikke.',
        tekst:
          'På vanlig aksjekonto (VPS) har hver aksje sitt eget skjermingsgrunnlag og sin egen akkumulerte skjerming — den kan ikke overføres mellom aksjer. Ved salg gjelder FIFU (først inn, først ut). På aksjesparekonto (ASK) er det motsatt: skjermingen knytter seg til kontoen som helhet, ikke til de enkelte aksjene, og du trenger ikke holde styr på FIFU i det hele tatt.',
        kilde:
          'Skatteetaten om ASK: «For verdipapirene som holdes på aksjesparekontoen er det dermed ikke nødvendig å beregne skjerming per aksje/andel, ei heller holde rede på FIFU.»',
      },
      {
        type: 'fallgruve',
        nr: 3,
        tittel: 'ASK: det er UTTAK som senker grunnlaget — ikke sene innskudd',
        tekst:
          'Skjermingsgrunnlaget på ASK er den laveste innskuddssaldoen gjennom året. Et uttak senker grunnlaget for hele året, også om du setter pengene inn igjen senere. Sene innskudd derimot skader ingenting — de teller bare ikke med i årets grunnlag.',
        kilde:
          'Skatteetatens eksempel: Har du 500 kr innskutt, skyter inn til 1 000 i april og tar ut 300 i mai — blir skjermingsgrunnlaget 500 kr, fordi det var laveste innskuddsbeløp i løpet av året.',
        eksempel: [
          ['Innskutt ved årets start', '500 kr'],
          ['Innskudd i april', '+ 500 → 1 000 kr'],
          ['Uttak i mai', '− 300 → 700 kr'],
          ['Skjermingsgrunnlag', '500 kr  (laveste i året)'],
        ],
      },
      {
        type: 'fallgruve',
        nr: 4,
        tittel: 'Skjerming kan ikke skape tap',
        tekst:
          'Ved salg kan ubenyttet skjerming redusere gevinsten til null — men den kan ikke skape eller øke et fradragsberettiget tap. Selger du med tap, faller gjenværende ubenyttet skjerming bort. For alltid. Sitter du på mye oppspart skjerming, sjekk den før du selger.',
        kilde:
          'Skatteetaten: «Det innrømmes ikke fradrag for ubenyttet skjerming med større beløp enn at gevinsten settes til null. Ubenyttet skjerming kan ikke øke fradragsberettiget tap.»',
      },
      {
        type: 'fallgruve',
        nr: 5,
        tittel: '31.12-regelen (VPS)',
        tekst:
          'På vanlig aksjekonto tilfaller hele årets skjerming den som eier aksjen 31. desember. Ingen forholdsmessig fordeling. Selger du i romjulen, gir du bort et helt års skjerming til kjøperen. Kjøper du før nyttår, får du hele årets skjerming — selv etter noen få dagers eierskap. (På ASK gjelder i stedet laveste innskuddssaldo, se fallgruve 3.)',
        kilde:
          'Skjermingen beregnes for aksjer man eier per 31. desember i inntektsåret.',
      },
    ],
  },

  {
    id: 'ask-vps',
    kilder: ['ask'],
    tittel: 'ASK eller VPS?',
    ingress: 'Hovedforskjellen ligger i når skatten inntreffer.',
    innhold: [
      {
        type: 'sammenlign',
        rader: [
          ['Utbytte', 'ASK: beskattes ikke løpende', 'VPS: beskattes samme år'],
          ['Gevinst ved salg', 'ASK: beskattes ikke inne i kontoen', 'VPS: beskattes ved salg'],
          ['Skatt utløses', 'ASK: ved uttak ut over innskutt kapital', 'VPS: løpende'],
          ['Skjerming beregnes', 'ASK: samlet på kontoen', 'VPS: per aksje'],
          ['FIFU ved salg', 'ASK: ikke relevant', 'VPS: gjelder'],
        ],
      },
      {
        type: 'tekst',
        tekst:
          'For en langsiktig investor som reinvesterer utbytte, gir ASK som regel bedre sammensatt vekst, siden ingenting beskattes løpende inne i kontoen. Skatten utløses først når du tar ut mer enn du har skutt inn.',
      },
    ],
  },

  {
    id: 'satser',
    kilder: ['skjermingsrente', 'oppjustering'],
    tittel: 'Satser og tall',
    ingress: 'Oppdateres årlig av Skatteetaten.',
    innhold: [
      {
        type: 'formel',
        tittel: `Gjeldende satser (${SATSER.skjermingsrenteAar})`,
        rader: [
          ['Skjermingsrente', SATSER.skjermingsrente],
          ['Alminnelig inntekt', SATSER.alminneligInntekt],
          ['Oppjusteringsfaktor', SATSER.oppjusteringsfaktor],
          ['Effektiv sats på aksjeinntekt', `${SATSER.effektivSats}  (22 % × 1,72)`],
        ],
      },
      {
        type: 'tekst',
        tekst:
          'Skjermingsrenten fastsettes årlig, basert på gjennomsnittlig rente på 3-måneders statskasseveksler. Effektiv sats fremkommer ved at aksjeinntekt oppjusteres med faktoren før den beskattes som alminnelig inntekt.',
      },
    ],
  },

  {
    id: 'sjekkliste',
    kilder: ['skjerming'],
    tittel: 'Sjekkliste',
    ingress: 'Fire ting å kontrollere — de tar fem minutter og kan spare deg for tusenlapper.',
    innhold: [
      {
        type: 'liste',
        punkter: [
          'Finn «ubenyttet skjerming» i fjorårets skattemelding. Vet du hvor mye du har oppspart, per aksje?',
          'Skal du selge noe du har eid lenge med lite utbytte? Sjekk oppspart skjerming først — den kan gå tapt.',
          'Handler du rundt årsskiftet? Husk 31.12-regelen.',
          'Utenlandske aksjer eller byttet megler? Dobbeltsjekk tallene — det er der det oftest glipper.',
        ],
      },
      {
        type: 'tekst',
        tekst:
          'Du kan endre skattemeldingen inntil tre år tilbake. Oppdager du feil i 2023, 2024 eller 2025, kan du rette det og få igjen penger.',
      },
    ],
  },
]
