import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { hentPriser } from '../lib/prices'
import { beregnASK, kr, krDes, SISTE_AAR, EFFEKTIV_SATS } from '../lib/skattekalkulator'
import { beregnVPSPortefolje, hentSkjermingRader, lagreSkjerming } from '../lib/skattemotor'
import { parseTransaksjonerCSV, beregnLavesteSaldo } from '../lib/nordnetTransaksjoner'

// ASK er kontobasert, ikke per aksje — bruker en fast nøkkel i skjerming-tabellen.
const ASK_NOEKKEL = '__ASK__'
const ASK_NAVN = 'Aksjesparekonto (ASK)'

const SKJERMING_SQL = `create table if not exists skjerming (
  bruker_id uuid not null references auth.users(id) on delete cascade,
  noekkel text not null,
  navn text,
  ubenyttet numeric not null default 0,
  aar integer not null,
  oppdatert timestamptz default now(),
  primary key (bruker_id, noekkel)
);

alter table skjerming enable row level security;

drop policy if exists "egen skjerming" on skjerming;
create policy "egen skjerming" on skjerming
  for all
  using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);`

function TallInput({ verdi, onChange, placeholder }) {
  return (
    <input
      className="motor-input"
      type="number"
      inputMode="decimal"
      value={verdi}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default function MinSkatt() {
  const { user } = useAuth()
  const [type, setType] = useState('vps')
  const [posisjoner, setPosisjoner] = useState([])
  const [prisdata, setPrisdata] = useState(null)
  const [skjermingRader, setSkjermingRader] = useState([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')
  const [utbytteOverstyrt, setUtbytteOverstyrt] = useState({})
  const [ubenyttetOverstyrt, setUbenyttetOverstyrt] = useState({})
  const [apen, setApen] = useState(null)
  const [lagrer, setLagrer] = useState(false)
  const [lagretOk, setLagretOk] = useState(false)
  const [manglerTabell, setManglerTabell] = useState(false)

  // ASK
  const [askTransaksjoner, setAskTransaksjoner] = useState(null)
  const [askCsvFeil, setAskCsvFeil] = useState('')
  const [askCsvNavn, setAskCsvNavn] = useState('')
  const [askStartSaldo, setAskStartSaldo] = useState('')
  const [askInnskudd, setAskInnskudd] = useState('')
  const [askUttak, setAskUttak] = useState('')
  const [askUbenyttet, setAskUbenyttet] = useState('')
  const [askUbenyttetTouched, setAskUbenyttetTouched] = useState(false)
  const askFileRef = useRef(null)

  useEffect(() => {
    let avbrutt = false
    async function last() {
      setLaster(true); setFeil(''); setManglerTabell(false)

      const { data: pos, error: posFeil } = await supabase
        .from('posisjoner').select('*').order('markedsverdi', { ascending: false })
      if (avbrutt) return
      if (posFeil) { setFeil(posFeil.message); setLaster(false); return }
      setPosisjoner(pos || [])

      try {
        setSkjermingRader(await hentSkjermingRader(supabase))
      } catch (e) {
        if (avbrutt) { /* ignorer */ }
        else if (/could not find the table|does not exist/i.test(e.message)) setManglerTabell(true)
        else setFeil('Fikk ikke hentet lagret skjerming (' + e.message + ')')
      }

      if (pos && pos.length > 0) {
        const priser = await hentPriser(pos).catch(() => null)
        if (!avbrutt) setPrisdata(priser)
      }
      if (!avbrutt) setLaster(false)
    }
    last()
    return () => { avbrutt = true }
  }, [])

  const skjermingMap = useMemo(
    () => new Map(skjermingRader.map((r) => [r.noekkel, r])),
    [skjermingRader]
  )

  const { rader, utenKostpris } = useMemo(
    () => beregnVPSPortefolje({ posisjoner, prisdata, skjermingRader, utbytteOverstyrt, ubenyttetOverstyrt }),
    [posisjoner, prisdata, skjermingRader, utbytteOverstyrt, ubenyttetOverstyrt]
  )

  async function handleAskFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    setAskCsvFeil('')
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseTransaksjonerCSV(buf)
      if (parsed.transaksjoner.length === 0) throw new Error('Fant ingen innskudd/uttak i fila (interne overføringer telles ikke med).')
      setAskTransaksjoner(parsed)
      setAskCsvNavn(file.name)
    } catch (err) {
      setAskCsvFeil(err.message); setAskTransaksjoner(null)
    } finally { if (askFileRef.current) askFileRef.current.value = '' }
  }

  const askBeregning = useMemo(() => (
    askTransaksjoner
      ? beregnLavesteSaldo({ transaksjoner: askTransaksjoner.transaksjoner, startSaldo: askStartSaldo, aar: SISTE_AAR })
      : null
  ), [askTransaksjoner, askStartSaldo])

  useEffect(() => {
    if (!askBeregning || askBeregning.antall === 0) return
    setAskInnskudd(String(Math.round(askBeregning.laveste)))
    const uttakIAar = askTransaksjoner.transaksjoner
      .filter((t) => t.dato.slice(0, 4) === String(SISTE_AAR) && t.belop < 0)
      .reduce((s, t) => s - t.belop, 0)
    setAskUttak(String(Math.round(uttakIAar)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askBeregning])

  useEffect(() => {
    if (askUbenyttetTouched) return
    const lagret = skjermingMap.get(ASK_NOEKKEL)
    if (lagret && lagret.aar === SISTE_AAR) setAskUbenyttet(String(Math.round(Number(lagret.ubenyttet) || 0)))
  }, [skjermingMap, askUbenyttetTouched])

  const askResultat = askInnskudd !== '' ? beregnASK({
    lavesteInnskudd: askInnskudd, uttak: askUttak, ubenyttetSkjerming: askUbenyttet, aar: SISTE_AAR,
  }) : null

  const totalt = useMemo(() => {
    const alle = [...rader.map((x) => x.r), ...(askResultat ? [askResultat] : [])]
    return alle.reduce((s, r) => ({
      skjerming: s.skjerming + r.skjerming,
      skattepliktig: s.skattepliktig + r.skattepliktig,
      skatt: s.skatt + r.skatt,
      spart: s.spart + r.spart,
    }), { skjerming: 0, skattepliktig: 0, skatt: 0, spart: 0 })
  }, [rader, askResultat])

  const noenUfullstendige = rader.some((x) => x.fantData && !x.dekkerHeleAaret)
  const harVPS = posisjoner.length > 0
  const harNoe = harVPS || askResultat

  async function handleLagre() {
    if (!user) return
    setLagrer(true); setLagretOk(false); setFeil('')
    try {
      const poster = rader.map((x) => ({ noekkel: x.noekkel, navn: x.navn, ubenyttet: x.r.nyUbenyttet, aar: SISTE_AAR + 1 }))
      if (askResultat) poster.push({ noekkel: ASK_NOEKKEL, navn: ASK_NAVN, ubenyttet: askResultat.nyUbenyttet, aar: SISTE_AAR + 1 })
      await lagreSkjerming(supabase, user.id, poster)
      setSkjermingRader(await hentSkjermingRader(supabase))
      setLagretOk(true)
    } catch (e) {
      setFeil(e.message)
    } finally {
      setLagrer(false)
    }
  }

  if (laster) return (
    <div className="page"><div className="page-head"><h1>Min skatt</h1></div><div className="muted-note">Laster …</div></div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Min skatt</h1>
        <p className="page-sub">Skjermingsfradrag {SISTE_AAR} — regnet ut automatisk der vi har data</p>
      </div>

      {feil && <div className="import-feil">{feil}</div>}

      {manglerTabell && (
        <div className="kalk-fremfor" style={{ marginBottom: 18 }}>
          <div className="kalk-fremfor-tittel">Én rask ting i Supabase, så lagres skjermingen din</div>
          <p>
            Ubenyttet skjerming lagres i en egen tabell som ikke finnes i prosjektet ditt ennå. Alt annet under
            fungerer helt fint uten den — du mister bare automatisk fremføring av skjerming til neste år inntil
            du oppretter den. Lim inn dette i Supabase → SQL Editor → Run (kun én gang):
          </p>
          <pre className="motor-sql">{SKJERMING_SQL}</pre>
        </div>
      )}

      <div className="kalk-import-disclaimer" style={{ marginBottom: 18 }}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        <div>
          Vanlig aksjekonto (VPS) regnes ut per aksje fra porteføljen din under. Aksjesparekonto (ASK) regnes ut
          på kontonivå fra et kontoutdrag du laster opp lenger ned — de to slås sammen i totalene øverst.
          Kostpris hentes fra GAV i din siste import, og utbytte fra faktisk utbetalingshistorikk — alle tall kan
          overstyres. Ubenyttet skjerming lagres og fremføres automatisk når du trykker «Lagre for neste år».
          Dette er en beregning, ikke skatterådgivning — kontroller alltid mot skattemeldingen din.
        </div>
      </div>

      {noenUfullstendige && (
        <div className="kalk-import-disclaimer" style={{ marginBottom: 18 }}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          <div>
            Kursdataleverandøren gir bare utbyttehistorikk 12 måneder tilbake i tid. Jo lenger det er siden
            årsskiftet, jo større sjanse for at utbetalinger tidlig i {SISTE_AAR} mangler i VPS-tallet under.
            Sjekk utbytte-feltene mot årsoppgaven fra megler før du stoler på totalen.
          </div>
        </div>
      )}

      {harNoe && (
        <div className="metrics">
          <div className="metric"><div className="k">Skjermingsfradrag totalt</div><div className="v">{krDes(totalt.skjerming)}</div><div className="d">{SISTE_AAR}</div></div>
          <div className="metric"><div className="k">Skattepliktig utbytte</div><div className="v">{krDes(totalt.skattepliktig)}</div><div className="d">Etter skjerming</div></div>
          <div className="metric"><div className="k">Skatt å betale</div><div className="v">{krDes(totalt.skatt)}</div><div className="d">{EFFEKTIV_SATS} % effektiv sats</div></div>
          <div className="metric"><div className="k">Du sparer</div><div className={'v' + (totalt.spart > 0 ? ' up' : '')}>{krDes(totalt.spart)}</div><div className="d">Takket være skjerming</div></div>
        </div>
      )}

      <div className="kalk-boks" style={{ maxWidth: '100%', margin: '0 0 20px' }}>
        <div className="kalk-faner">
          <button className={'kalk-fane' + (type === 'vps' ? ' on' : '')} onClick={() => setType('vps')}>
            Vanlig konto (VPS)
          </button>
          <button className={'kalk-fane' + (type === 'ask' ? ' on' : '')} onClick={() => setType('ask')}>
            Aksjesparekonto (ASK)
          </button>
        </div>
      </div>

      {type === 'vps' && (harVPS ? (
        <div className="panel">
          <div className="panel-h"><h2>VPS — per aksje</h2><span className="hint">Klikk en rad for regnestykket</span></div>
          <table className="holdings motor-tabell">
            <thead>
              <tr>
                <th>Aksje</th>
                <th className="r">Kostpris</th>
                <th className="r">Utbytte i {SISTE_AAR}</th>
                <th className="r">Ubenyttet inn</th>
                <th className="r">Skjermingsfradrag</th>
                <th className="r">Skatt</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((x) => (
                <Fragment key={x.noekkel}>
                  <tr className="motor-rad" onClick={() => setApen(apen === x.noekkel ? null : x.noekkel)}>
                    <td><div className="tick"><span className="nm">{x.navn}</span></div></td>
                    <td className="r mono">{kr(x.r.inngangsverdi)}</td>
                    <td className="r mono" onClick={(e) => e.stopPropagation()}>
                      <TallInput
                        verdi={x.utbytteFelt}
                        onChange={(v) => setUtbytteOverstyrt((s) => ({ ...s, [x.noekkel]: v }))}
                        placeholder="0"
                      />
                    </td>
                    <td className="r mono" onClick={(e) => e.stopPropagation()}>
                      <TallInput
                        verdi={x.ubenyttetFelt}
                        onChange={(v) => setUbenyttetOverstyrt((s) => ({ ...s, [x.noekkel]: v }))}
                        placeholder="0"
                      />
                    </td>
                    <td className="r mono wt">{krDes(x.r.skjerming)}</td>
                    <td className="r mono">{krDes(x.r.skatt)}</td>
                  </tr>
                  {apen === x.noekkel && (
                    <tr className="motor-detalj-rad">
                      <td colSpan={6}>
                        <div className="kalk-regnestykke motor-detalj">
                          <div className="kalk-rad"><span>Kostpris</span><b>{kr(x.r.inngangsverdi)}</b></div>
                          {x.r.ubenyttetInn > 0 && <div className="kalk-rad"><span>+ Ubenyttet skjerming fra i fjor</span><b>{kr(x.r.ubenyttetInn)}</b></div>}
                          <div className="kalk-rad sum"><span>= Skjermingsgrunnlag</span><b>{kr(x.r.grunnlag)}</b></div>
                          <div className="kalk-rad"><span>× Skjermingsrente {SISTE_AAR}</span><b>{x.r.rente} %</b></div>
                          <div className="kalk-rad resultat"><span>= Skjermingsfradrag</span><b>{krDes(x.r.skjerming)}</b></div>
                          <div className="kalk-rad" style={{ marginTop: 10 }}><span>Utbytte mottatt</span><b>{kr(x.r.utbytte)}</b></div>
                          <div className="kalk-rad"><span>− Skjermingsfradrag</span><b>−{krDes(Math.min(x.r.skjerming, x.r.utbytte))}</b></div>
                          <div className="kalk-rad sum"><span>= Skattepliktig</span><b>{krDes(x.r.skattepliktig)}</b></div>
                          <div className="kalk-rad resultat"><span>= Skatt å betale</span><b>{krDes(x.r.skatt)}</b></div>
                          {x.r.nyUbenyttet > 0 && (
                            <div className="kalk-rad" style={{ marginTop: 10 }}><span>Ubenyttet skjerming videre til {SISTE_AAR + 1}</span><b>{kr(x.r.nyUbenyttet)}</b></div>
                          )}
                          {!x.fantData && <div className="import-hint" style={{ marginTop: 10 }}>Fant ikke utbyttehistorikk automatisk for denne aksjen — utbytte må fylles inn manuelt.</div>}
                        </div>

                        {x.g && (
                          <div className="kalk-regnestykke motor-detalj" style={{ marginTop: 10 }}>
                            <div className="kalk-tittel">
                              Hvis du selger i dag{!x.harLivePris && ' (verdi fra siste import, ikke live)'}
                            </div>
                            <div className="kalk-rad"><span>Verdi nå</span><b>{kr(x.verdiNaa)}</b></div>
                            <div className="kalk-rad"><span>− Kostpris</span><b>−{kr(x.g.inngangsverdi)}</b></div>
                            <div className="kalk-rad sum">
                              <span>= {x.g.erGevinst ? 'Gevinst før skjerming' : 'Tap'}</span>
                              <b>{x.g.erGevinst ? kr(x.g.gevinstFoerSkjerming) : kr(x.g.tap)}</b>
                            </div>
                            {x.g.erGevinst ? (
                              <>
                                <div className="kalk-rad"><span>− Skjermingsfradrag brukt</span><b>−{krDes(x.g.brukt)}</b></div>
                                <div className="kalk-rad sum"><span>= Skattepliktig gevinst</span><b>{krDes(x.g.skattepliktig)}</b></div>
                                <div className="kalk-rad resultat"><span>= Skatt ved salg</span><b>{krDes(x.g.skatt)}</b></div>
                              </>
                            ) : (
                              <div className="kalk-rad resultat"><span>= Skattebesparelse (fradrag)</span><b>{krDes(Math.abs(x.g.skattEffekt))}</b></div>
                            )}
                            {x.g.bortfaltSkjerming > 0 && (
                              <div className="import-hint" style={{ marginTop: 10 }}>
                                {krDes(x.g.bortfaltSkjerming)} i skjerming ville gått tapt ved salg — den fremføres
                                ikke slik den gjør ved utbytte.
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="import-card">
          <div className="import-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg></div>
          <h2>Ingen VPS-portefølje importert</h2>
          <p>Importer porteføljen din for å få skjermingsfradrag per aksje regnet ut automatisk.</p>
          <Link className="btn" to="/app/portefolje">Gå til Min portefølje</Link>
        </div>
      ))}

      {type === 'vps' && utenKostpris.length > 0 && (
        <div className="muted-note">
          {utenKostpris.length} posisjon{utenKostpris.length > 1 ? 'er' : ''} mangler kostpris (GAV) i importen og
          er ikke tatt med: {utenKostpris.map((p) => p.navn).join(', ')}.
        </div>
      )}

      {type === 'ask' && (
      <div className="panel">
        <div className="panel-h"><h2>Aksjesparekonto (ASK)</h2></div>
        <div className="kalk-import">
          <div className="kalk-import-head">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
            <div>
              <label>Regn ut fra kontoutdrag</label>
              <div className="kalk-hjelp">Last opp transaksjonseksporten fra Nordnet, så regner vi ut laveste innskuddssaldo og uttak automatisk.</div>
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={() => askFileRef.current?.click()}>
            {askCsvNavn ? 'Bytt fil (' + askCsvNavn + ')' : 'Velg CSV-fil'}
          </button>
          <input ref={askFileRef} type="file" accept=".csv,text/csv" hidden onChange={handleAskFile} />
          {askCsvFeil && <div className="import-feil">{askCsvFeil}</div>}
          {askTransaksjoner && askBeregning.antall === 0 && (
            askTransaksjoner.forsteDato > `${SISTE_AAR}-12-31` ? (
              <div className="kalk-import-disclaimer">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                <div>
                  Kontoen din ser ut til å være opprettet etter {SISTE_AAR} (første transaksjon: {askTransaksjoner.forsteDato}) —
                  da har du ikke opptjent skjermingsfradrag for {SISTE_AAR} ennå. Dette er ikke en feil. Du får ditt første
                  skjermingsfradrag på denne kontoen når Skatteetaten fastsetter skjermingsrenten for {SISTE_AAR + 1}, i januar {SISTE_AAR + 2}.
                </div>
              </div>
            ) : (
              <div className="import-feil">
                Fila di har transaksjoner mellom {askTransaksjoner.forsteDato} og {askTransaksjoner.sisteDato} — ikke i{' '}
                {SISTE_AAR}. Skattemotoren kan foreløpig bare regne skjermingsfradrag for {SISTE_AAR}, siden Skatteetaten
                først fastsetter skjermingsrenten for et inntektsår i januar året etter.
              </div>
            )
          )}
          {askTransaksjoner && askBeregning.antall > 0 && (
            <>
              <Felt label="Saldo rett før første transaksjon i filen"
                hjelp={`Vanligvis saldoen din 1. januar. Fila har transaksjoner fra ${askTransaksjoner.forsteDato} til ${askTransaksjoner.sisteDato}.`}
                verdi={askStartSaldo} setVerdi={setAskStartSaldo} valgfri />
              <div className="kalk-import-disclaimer">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                <div>
                  Dette forutsetter at feltet over er riktig saldo rett før {askTransaksjoner.forsteDato}, og at fila
                  dekker resten av {SISTE_AAR} uten hull. Interne overføringer mellom dine egne Nordnet-kontoer telles
                  ikke med. Kontroller alltid mot kontoutdraget ditt før du bruker det i skattemeldingen.
                </div>
              </div>
            </>
          )}
        </div>

        {askResultat && (
          <>
            <div className="kalk-regnestykke" style={{ marginTop: 16 }}>
              <div className="kalk-tittel">Slik regnes det ut</div>
              <div className="kalk-rad"><span>Laveste innskuddssaldo</span>
                <b><TallInput verdi={askInnskudd} onChange={setAskInnskudd} placeholder="0" /></b>
              </div>
              <div className="kalk-rad"><span>+ Ubenyttet skjerming inn</span>
                <b><TallInput verdi={askUbenyttet} onChange={(v) => { setAskUbenyttetTouched(true); setAskUbenyttet(v) }} placeholder="0" /></b>
              </div>
              <div className="kalk-rad sum"><span>= Skjermingsgrunnlag</span><b>{kr(askResultat.grunnlag)}</b></div>
              <div className="kalk-rad"><span>× Skjermingsrente {SISTE_AAR}</span><b>{askResultat.rente} %</b></div>
              <div className="kalk-rad resultat"><span>= Skjermingsfradrag</span><b>{krDes(askResultat.skjerming)}</b></div>
              <div className="kalk-rad" style={{ marginTop: 10 }}><span>Uttak i {SISTE_AAR}</span>
                <b><TallInput verdi={askUttak} onChange={setAskUttak} placeholder="0" /></b>
              </div>
              <div className="kalk-rad"><span>− Skjermingsfradrag</span><b>−{krDes(Math.min(askResultat.skjerming, askResultat.uttak))}</b></div>
              <div className="kalk-rad sum"><span>= Skattepliktig</span><b>{krDes(askResultat.skattepliktig)}</b></div>
              <div className="kalk-rad resultat"><span>= Skatt å betale</span><b>{krDes(askResultat.skatt)}</b></div>
              {askResultat.nyUbenyttet > 0 && (
                <div className="kalk-rad" style={{ marginTop: 10 }}><span>Ubenyttet skjerming videre til {SISTE_AAR + 1}</span><b>{kr(askResultat.nyUbenyttet)}</b></div>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {harNoe && (
        <div className="kalk-bunn">
          <button className="btn" disabled={lagrer} onClick={handleLagre}>
            {lagrer ? 'Lagrer …' : 'Lagre for neste år'}
          </button>
          {lagretOk && <div className="kalk-import-ok" style={{ marginTop: 12 }}>✓ Ubenyttet skjerming er lagret og fremføres automatisk til {SISTE_AAR + 1}.</div>}
        </div>
      )}
    </div>
  )
}

function Felt({ label, hjelp, verdi, setVerdi, valgfri }) {
  return (
    <div className="kalk-felt">
      <label>
        {label}
        {valgfri && <span className="kalk-valgfri">valgfritt</span>}
      </label>
      {hjelp && <div className="kalk-hjelp">{hjelp}</div>}
      <div className="kalk-input">
        <input
          type="number"
          inputMode="decimal"
          value={verdi}
          onChange={(e) => setVerdi(e.target.value)}
          placeholder="0"
        />
        <span className="kalk-enhet">kr</span>
      </div>
    </div>
  )
}
