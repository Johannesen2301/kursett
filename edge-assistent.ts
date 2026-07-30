// Kursett — Edge Function «assistent»
//
// Lim inn HELE denne i Supabase → Edge Functions → Deploy a new function
// → Via Editor. Kall funksjonen «assistent». Filen må hete index.ts.
//
// VIKTIG: Du må sette API-nøkkelen som secret FØR den virker:
// Supabase → Edge Functions → Secrets → Add secret
//   Navn:  ANTHROPIC_API_KEY
//   Verdi: din nøkkel fra console.anthropic.com
//
// Nøkkelen ligger KUN her på serveren. Aldri i frontend.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Enkel rate-limiting i minnet: maks 10 spørsmål per IP per time.
const teller = new Map<string, { antall: number; nullstilles: number }>()
const GRENSE = 5
const VINDU_MS = 60 * 60 * 1000

function overGrensen(ip: string): boolean {
  const naa = Date.now()
  const t = teller.get(ip)
  if (!t || naa > t.nullstilles) {
    teller.set(ip, { antall: 1, nullstilles: naa + VINDU_MS })
    return false
  }
  if (t.antall >= GRENSE) return true
  t.antall++
  return false
}

const SYSTEM = `Du er Kursett-assistenten. Du hjelper norske investorer med to ting:
norsk aksjeskatt, og hvordan de bruker Kursett.

ABSOLUTTE REGLER — brudd på disse er alvorlig:

1. Du svarer KUN fra kunnskapsgrunnlaget under. Ingenting annet.
2. Står ikke svaret der, sier du det rett ut: "Det dekker vi ikke ennå — sjekk
   skatteetaten.no eller spør en regnskapsfører." Du GJETTER ALDRI.
3. Du regner aldri ut skatt for noen basert på tall de oppgir uten å vise
   formelen og be dem kontrollere mot Skatteetaten.
4. Du gir ALDRI investeringsråd. Ikke hva de bør kjøpe, selge eller eie.
   Du forklarer regler og konsekvenser — du anbefaler ikke handlinger.
5. Du gir ikke skatteplanleggingsråd eller tilpasningsstrategier. Forklarer du
   en regel, forklarer du hva den ER, ikke hvordan man utnytter den.
6. Du er ikke skatterådgiver. Minn om det når svaret gjelder noens egen økonomi.

STIL:
- Skriv på norsk, i klart hverdagsspråk. Ikke byråkratisk.
- Vær konkret. Bruk tall og eksempler fra grunnlaget når det hjelper.
- Kort er bedre enn langt. To-tre avsnitt holder som regel.
- Er du usikker, si det. Usikkerhet er bedre enn å høres sikker ut og ta feil.
- Skill alltid tydelig mellom ASK og VPS — reglene er forskjellige, og det er
  her folk oftest tar feil.

Når noen spør om noe utenfor skatt og Kursett (aksjetips, markedssyn, andre
tjenester), sier du vennlig at du kun hjelper med norsk aksjeskatt og bruk av
Kursett.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ukjent'
    if (overGrensen(ip)) {
      return new Response(
        JSON.stringify({
          feil: 'Du har brukt opp de gratis spørsmålene dine denne timen.',
          proGrense: true,
        }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const { melding, historikk, grunnlag } = await req.json()

    if (!melding || typeof melding !== 'string') {
      return new Response(JSON.stringify({ feil: 'Mangler spørsmål.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (melding.length > 1000) {
      return new Response(JSON.stringify({ feil: 'Spørsmålet er for langt.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const noekkel = Deno.env.get('ANTHROPIC_API_KEY')
    if (!noekkel) {
      return new Response(JSON.stringify({ feil: 'Assistenten er ikke satt opp ennå.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Bygg meldinger: tidligere samtale + nytt spørsmål
    const meldinger = []
    if (Array.isArray(historikk)) {
      for (const m of historikk.slice(-6)) {
        if (m?.rolle === 'bruker' || m?.rolle === 'assistent') {
          meldinger.push({
            role: m.rolle === 'bruker' ? 'user' : 'assistant',
            content: String(m.tekst).slice(0, 2000),
          })
        }
      }
    }
    meldinger.push({ role: 'user', content: melding })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': noekkel,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system: `${SYSTEM}\n\n=== KUNNSKAPSGRUNNLAG ===\n${grunnlag ?? ''}`,
        messages: meldinger,
      }),
    })

    if (!res.ok) {
      const t = await res.text()
      return new Response(JSON.stringify({ feil: 'Assistenten er utilgjengelig akkurat nå.', detalj: t.slice(0, 200) }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const svar = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()

    return new Response(JSON.stringify({ svar }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ feil: String(e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
