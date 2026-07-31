import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  beregnVPS, beregnASK, beregnGevinstVedSalg, kr, krDes,
  SKJERMINGSRENTE, EFFEKTIV_SATS, SISTE_AAR,
} from '../lib/skattekalkulator'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { parseTransaksjonerCSV, beregnLavesteSaldo } from '../lib/nordnetTransaksjoner'
import Assistent from '../components/Assistent'
import Seo from '../components/Seo'

function Felt({ label, hjelp, verdi, setVerdi, enhet = 'kr', valgfri }) {
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
        <span className="kalk-enhet">{enhet}</span>
      </div>
    </div>
  )
}

export default function Kalkulator() {
  const [type, setType] = useState('vps')
  const { user } = useAuth()

  // VPS
  const [kostpris, setKostpris] = useState('')
  const [kurtasje, setKurtasje] = useState('')
  const [utbytte, setUtbytte] = useState('')
  const [ubenyttet, setUbenyttet] = useState('')
  const [kostprisKilde, setKostprisKilde] = useState('manuell') // 'manuell' | 'import'
  const [posisjoner, setPosisjoner] = useState([])
  const [valgtPosisjonId, setValgtPosisjonId] = useState('')

  useEffect(() => {
    if (!user) { setPosisjoner([]); return }
    supabase.from('posisjoner').select('id, navn, antall, gav, konto, konto_type').order('markedsverdi', { ascending: false })
      .then(({ data }) => setPosisjoner((data || [])
        .filter((p) => p.gav != null && p.antall != null && p.konto_type !== 'ask')))
  }, [user])

  function velgPosisjon(id) {
    setValgtPosisjonId(id)
    const p = posisjoner.find((p) => String(p.id) === id)
    if (!p) return
    setKostpris(String(Math.round(p.gav * p.antall)))
    setKurtasje('0')
    setKostprisKilde('import')
  }

  function endreKostprisManuelt(v) {
    setKostpris(v)
    setKostprisKilde('manuell')
  }

  // ASK
  const [innskudd, setInnskudd] = useState('')
  const [uttak, setUttak] = useState('')
  const [ubenyttetAsk, setUbenyttetAsk] = useState('')
  const [askStartSaldo, setAskStartSaldo] = useState('')
  const [askTransaksjoner, setAskTransaksjoner] = useState(null)
  const [askCsvFeil, setAskCsvFeil] = useState('')
  const [askCsvNavn, setAskCsvNavn] = useState('')
  const askFileRef = useRef(null)

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

  const askBeregning = askTransaksjoner
    ? beregnLavesteSaldo({ transaksjoner: askTransaksjoner.transaksjoner, startSaldo: askStartSaldo, aar: SISTE_AAR })
    : null

  useEffect(() => {
    if (!askBeregning || askBeregning.antall === 0) return
    setInnskudd(String(Math.round(askBeregning.laveste)))
  }, [askTransaksjoner, askStartSaldo])

  // Salg (gevinst/tap ved salg av aksjer, VPS)
  const [salgKostpris, setSalgKostpris] = useState('')
  const [salgKurtasje, setSalgKurtasje] = useState('')
  const [salgssum, setSalgssum] = useState('')
  const [salgskurtasje, setSalgskurtasje] = useState('')
  const [salgUbenyttet, setSalgUbenyttet] = useState('')
  const [salgKostprisKilde, setSalgKostprisKilde] = useState('manuell')
  const [salgValgtPosisjonId, setSalgValgtPosisjonId] = useState('')

  function velgSalgPosisjon(id) {
    setSalgValgtPosisjonId(id)
    const p = posisjoner.find((p) => String(p.id) === id)
    if (!p) return
    setSalgKostpris(String(Math.round(p.gav * p.antall)))
    setSalgKurtasje('0')
    setSalgKostprisKilde('import')
  }

  function endreSalgKostprisManuelt(v) {
    setSalgKostpris(v)
    setSalgKostprisKilde('manuell')
  }

  const harVPS = kostpris !== ''
  const harASK = innskudd !== ''
  const harSalg = salgKostpris !== '' && salgssum !== ''

  const r = type === 'vps'
    ? beregnVPS({ kostpris, kurtasje, utbytte, ubenyttetSkjerming: ubenyttet })
    : type === 'ask'
    ? beregnASK({ lavesteInnskudd: innskudd, uttak, ubenyttetSkjerming: ubenyttetAsk })
    : beregnGevinstVedSalg({
        kostpris: salgKostpris, kurtasje: salgKurtasje, salgssum, salgskurtasje,
        ubenyttetSkjerming: salgUbenyttet,
      })

  const visResultat = type === 'vps' ? harVPS : type === 'ask' ? harASK : harSalg

  return (
    <div className="kalk-side">
      <Seo
        tittel="Skjermingsfradrag kalkulator 2025 — regn ut fradraget ditt | Kursett"
        beskrivelse="Regn ut skjermingsfradraget på aksjer og aksjesparekonto (ASK). Gratis kalkulator med hele regnestykket forklart. Skjermingsrente 2025: 3,6 %."
        sti="/"
        faq={[
          {
            sporsmal: 'Hva er skjermingsfradrag?',
            svar: 'Skjermingsfradraget er et årlig fradrag som gjør at den delen av aksjeavkastningen som tilsvarer risikofri rente ikke beskattes. Det beregnes som skjermingsgrunnlag ganget med skjermingsrenten, som for 2025 er 3,6 prosent.',
          },
          {
            sporsmal: 'Hvordan beregnes skjermingsgrunnlaget?',
            svar: 'På vanlig aksjekonto (VPS) er skjermingsgrunnlaget inngangsverdien (kostpris pluss kurtasje) pluss ubenyttet skjerming fra tidligere år. På aksjesparekonto (ASK) er det laveste innskuddssaldo i året pluss ubenyttet skjerming.',
          },
          {
            sporsmal: 'Hva skjer med ubenyttet skjerming?',
            svar: 'Er skjermingen større enn utbyttet, fremføres det som ikke ble brukt. Det legges til skjermingsgrunnlaget året etter, slik at neste års skjerming blir høyere. Det gir en rentes-rente-effekt.',
          },
        ]}
      />
      <div className="kalk-topp">
        <div className="kalk-logo">
          <span className="kur">Kur</span><span className="sett">sett</span><span className="d" />
        </div>
        <div className="kalk-nav">
          <Link to="/skatteregler" className="kalk-lenke">Skatteregler</Link>
          <Link to="/login" className="kalk-logginn">Logg inn</Link>
        </div>
      </div>

      <div className="kalk-hero">
        <h1>Regn ut skjermingsfradraget ditt</h1>
        <p>
          Skjermingsfradraget er et årlig frikort på utbytte og gevinst. Legg inn tallene dine,
          så viser vi hele regnestykket — og hva du sparer i skatt.
        </p>
      </div>

      <div className="kalk-boks">
        <div className="kalk-faner">
          <button className={'kalk-fane' + (type === 'vps' ? ' on' : '')} onClick={() => setType('vps')}>
            Vanlig konto (VPS)
          </button>
          <button className={'kalk-fane' + (type === 'ask' ? ' on' : '')} onClick={() => setType('ask')}>
            Aksjesparekonto (ASK)
          </button>
          <button className={'kalk-fane' + (type === 'salg' ? ' on' : '')} onClick={() => setType('salg')}>
            Salg av aksjer
          </button>
        </div>

        <div className="kalk-innhold">
          {type === 'vps' ? (
            <>
              {user && posisjoner.length > 0 && (
                <div className="kalk-import">
                  <div className="kalk-import-head">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                    <div>
                      <label>Hent kostpris fra porteføljen</label>
                      <div className="kalk-hjelp">Bruker GAV × antall fra din siste import.</div>
                    </div>
                  </div>
                  <select className="kalk-select" value={valgtPosisjonId} onChange={(e) => velgPosisjon(e.target.value)}>
                    <option value="">— velg en importert posisjon —</option>
                    {posisjoner.map((p) => (
                      <option key={p.id} value={p.id}>{p.navn} ({p.antall} stk{p.konto ? ', ' + p.konto : ''})</option>
                    ))}
                  </select>
                  {kostprisKilde === 'import' && (
                    <div className="kalk-import-disclaimer">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
                      </svg>
                      <div>
                        Kostprisen er hentet fra GAV i din import og er ikke kvalitetssikret av Kursett.
                        Kontroller alltid tallet mot kontoutskriften din før du bruker det i skattemeldingen —
                        du er selv ansvarlig for at opplysningene i skattemeldingen din er riktige.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Felt label="Hva betalte du for aksjene?" hjelp="Kostpris — det du kjøpte for"
                verdi={kostpris} setVerdi={endreKostprisManuelt} />
              {kostprisKilde === 'import' ? (
                <div className="kalk-felt">
                  <label>Kurtasje</label>
                  <div className="kalk-kurtasje-info">
                    <span>Inkludert i GAV — legges ikke til på nytt.</span>
                    <button type="button" onClick={() => setKostprisKilde('manuell')}>Skriv inn selv</button>
                  </div>
                </div>
              ) : (
                <Felt label="Kurtasje" hjelp="Gebyret du betalte ved kjøp. Legges til kostprisen."
                  verdi={kurtasje} setVerdi={setKurtasje} valgfri />
              )}
              <Felt label="Utbytte mottatt i år" verdi={utbytte} setVerdi={setUtbytte} valgfri />
              <Felt label="Ubenyttet skjerming fra tidligere år"
                hjelp="Står i fjorårets skattemelding. Legges til grunnlaget."
                verdi={ubenyttet} setVerdi={setUbenyttet} valgfri />
            </>
          ) : type === 'ask' ? (
            <>
              <div className="kalk-import">
                <div className="kalk-import-head">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                  <div>
                    <label>Regn ut fra kontoutdrag</label>
                    <div className="kalk-hjelp">Last opp transaksjonseksporten fra megleren din, så regner vi ut laveste innskuddssaldo automatisk.</div>
                  </div>
                </div>
                <button type="button" className="btn ghost" onClick={() => askFileRef.current?.click()}>
                  {askCsvNavn ? 'Bytt fil (' + askCsvNavn + ')' : 'Velg CSV-fil'}
                </button>
                <input ref={askFileRef} type="file" accept=".csv,text/csv" hidden onChange={handleAskFile} />
                {askCsvFeil && <div className="import-feil">{askCsvFeil}</div>}
                {askTransaksjoner && askBeregning.antall === 0 && (
                  <div className="import-feil">
                    Fila di har transaksjoner mellom {askTransaksjoner.forsteDato} og {askTransaksjoner.sisteDato} — ikke i{' '}
                    {SISTE_AAR}. Kalkulatoren kan foreløpig bare regne skjermingsfradrag for {SISTE_AAR}, siden Skatteetaten
                    først fastsetter skjermingsrenten for et inntektsår i januar året etter. Last opp et kontoutdrag som
                    dekker {SISTE_AAR} for å bruke denne funksjonen.
                  </div>
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
                        dekker resten av {SISTE_AAR} uten hull. Interne overføringer mellom dine egne kontoer telles
                        ikke med. Kursett kvalitetssikrer ikke dette tallet — kontroller alltid mot kontoutdraget ditt før du
                        bruker det i skattemeldingen. Du er selv ansvarlig for at opplysningene i skattemeldingen din er riktige.
                      </div>
                    </div>
                  </>
                )}
              </div>
              {askBeregning && askBeregning.antall > 0 && (
                <div className="kalk-import-ok">
                  ✓ Beregnet fra {askCsvNavn}: laveste innskuddssaldo {kr(askBeregning.laveste)}
                </div>
              )}
              <Felt label="Laveste innskuddssaldo i året"
                hjelp="Ikke beholdningen — det laveste nivået på innskutt kapital gjennom året. Uttak senker dette."
                verdi={innskudd} setVerdi={setInnskudd} />
              <Felt label="Uttak i år" hjelp="Det du har tatt ut av kontoen"
                verdi={uttak} setVerdi={setUttak} valgfri />
              <Felt label="Ubenyttet skjerming fra tidligere år"
                verdi={ubenyttetAsk} setVerdi={setUbenyttetAsk} valgfri />
            </>
          ) : (
            <>
              <div className="kalk-import-disclaimer">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
                </svg>
                <div>
                  Selger du HELE beholdningen av denne aksjen, er tallene under korrekte. Selger du bare EN DEL,
                  krever Skatteetaten at de eldste aksjene dine regnes som solgt først (FIFO) med sin egen faktiske
                  kostpris — hvis du kjøpte til ulike priser over tid, kan riktig skattetall avvike noe fra det
                  denne kalkulatoren viser her.
                </div>
              </div>
              {user && posisjoner.length > 0 && (
                <div className="kalk-import">
                  <div className="kalk-import-head">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                    <div>
                      <label>Hent kostpris fra porteføljen</label>
                      <div className="kalk-hjelp">Bruker GAV × antall fra din siste import.</div>
                    </div>
                  </div>
                  <select className="kalk-select" value={salgValgtPosisjonId} onChange={(e) => velgSalgPosisjon(e.target.value)}>
                    <option value="">— velg en importert posisjon —</option>
                    {posisjoner.map((p) => (
                      <option key={p.id} value={p.id}>{p.navn} ({p.antall} stk{p.konto ? ', ' + p.konto : ''})</option>
                    ))}
                  </select>
                  {salgKostprisKilde === 'import' && (
                    <div className="kalk-import-disclaimer">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
                      </svg>
                      <div>
                        Kostprisen er hentet fra GAV i din import og er ikke kvalitetssikret av Kursett.
                        Kontroller alltid tallet mot kontoutskriften din før du bruker det i skattemeldingen —
                        du er selv ansvarlig for at opplysningene i skattemeldingen din er riktige.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Felt label="Hva betalte du for aksjene?" hjelp="Kostpris — det du kjøpte for"
                verdi={salgKostpris} setVerdi={endreSalgKostprisManuelt} />
              {salgKostprisKilde === 'import' ? (
                <div className="kalk-felt">
                  <label>Kurtasje ved kjøp</label>
                  <div className="kalk-kurtasje-info">
                    <span>Inkludert i GAV — legges ikke til på nytt.</span>
                    <button type="button" onClick={() => setSalgKostprisKilde('manuell')}>Skriv inn selv</button>
                  </div>
                </div>
              ) : (
                <Felt label="Kurtasje ved kjøp" hjelp="Gebyret du betalte ved kjøp. Legges til kostprisen."
                  verdi={salgKurtasje} setVerdi={setSalgKurtasje} valgfri />
              )}
              <Felt label="Salgssum" hjelp="Det du solgte aksjene for"
                verdi={salgssum} setVerdi={setSalgssum} />
              <Felt label="Kurtasje ved salg" hjelp="Gebyret du betalte ved salg. Trekkes fra salgssummen."
                verdi={salgskurtasje} setVerdi={setSalgskurtasje} valgfri />
              <Felt label="Ubenyttet skjerming fra tidligere år"
                hjelp="Står i fjorårets skattemelding. Legges til grunnlaget."
                verdi={salgUbenyttet} setVerdi={setSalgUbenyttet} valgfri />
            </>
          )}
        </div>
      </div>

      {visResultat && (
        <div className="kalk-svar">
          <div className="kalk-hovedtall">
            <div className="kalk-label">Ditt skjermingsfradrag {SISTE_AAR}</div>
            <div className="kalk-tall">{krDes(r.skjerming)}</div>
          </div>

          <div className="kalk-regnestykke">
            <div className="kalk-tittel">Slik regnes det ut</div>

            {type === 'vps' ? (
              <>
                <div className="kalk-rad">
                  <span>Kostpris</span><b>{kr(Number(kostpris) || 0)}</b>
                </div>
                {Number(kurtasje) > 0 && (
                  <div className="kalk-rad"><span>+ Kurtasje</span><b>{kr(Number(kurtasje))}</b></div>
                )}
                {Number(ubenyttet) > 0 && (
                  <div className="kalk-rad"><span>+ Ubenyttet skjerming fra i fjor</span><b>{kr(Number(ubenyttet))}</b></div>
                )}
                <div className="kalk-rad sum">
                  <span>= Skjermingsgrunnlag</span><b>{kr(r.grunnlag)}</b>
                </div>
                <div className="kalk-rad">
                  <span>× Skjermingsrente {SISTE_AAR}</span><b>{r.rente} %</b>
                </div>
                <div className="kalk-rad resultat">
                  <span>= Skjermingsfradrag</span><b>{krDes(r.skjerming)}</b>
                </div>
              </>
            ) : type === 'ask' ? (
              <>
                <div className="kalk-rad"><span>Laveste innskuddssaldo</span><b>{kr(r.innskudd)}</b></div>
                {Number(ubenyttetAsk) > 0 && (
                  <div className="kalk-rad"><span>+ Ubenyttet skjerming</span><b>{kr(Number(ubenyttetAsk))}</b></div>
                )}
                <div className="kalk-rad sum"><span>= Skjermingsgrunnlag</span><b>{kr(r.grunnlag)}</b></div>
                <div className="kalk-rad"><span>× Skjermingsrente {SISTE_AAR}</span><b>{r.rente} %</b></div>
                <div className="kalk-rad resultat"><span>= Skjermingsfradrag</span><b>{krDes(r.skjerming)}</b></div>
              </>
            ) : (
              <>
                <div className="kalk-rad"><span>Kostpris</span><b>{kr(Number(salgKostpris) || 0)}</b></div>
                {Number(salgKurtasje) > 0 && (
                  <div className="kalk-rad"><span>+ Kurtasje ved kjøp</span><b>{kr(Number(salgKurtasje))}</b></div>
                )}
                {Number(salgUbenyttet) > 0 && (
                  <div className="kalk-rad"><span>+ Ubenyttet skjerming fra i fjor</span><b>{kr(Number(salgUbenyttet))}</b></div>
                )}
                <div className="kalk-rad sum">
                  <span>= Skjermingsgrunnlag</span><b>{kr(r.grunnlag)}</b>
                </div>
                <div className="kalk-rad">
                  <span>× Skjermingsrente {SISTE_AAR}</span><b>{r.rente} %</b>
                </div>
                <div className="kalk-rad resultat">
                  <span>= Skjermingsfradrag tilgjengelig</span><b>{krDes(r.skjerming)}</b>
                </div>
              </>
            )}
          </div>

          {type === 'salg' ? (
            harSalg && (
              <div className="kalk-regnestykke">
                <div className="kalk-tittel">{r.erGevinst ? 'Hva du betaler i skatt' : 'Fradragsberettiget tap'}</div>
                <div className="kalk-rad">
                  <span>Salgssum</span><b>{kr(r.salgssum)}</b>
                </div>
                <div className="kalk-rad">
                  <span>− Kostpris</span><b>−{kr(r.inngangsverdi)}</b>
                </div>
                <div className="kalk-rad sum">
                  <span>= {r.erGevinst ? 'Gevinst før skjerming' : 'Tap'}</span>
                  <b>{r.erGevinst ? kr(r.gevinstFoerSkjerming) : kr(r.tap)}</b>
                </div>

                {r.erGevinst ? (
                  <>
                    <div className="kalk-rad">
                      <span>− Skjermingsfradrag brukt</span><b>−{krDes(r.brukt)}</b>
                    </div>
                    <div className="kalk-rad sum">
                      <span>= Skattepliktig gevinst</span><b>{krDes(r.skattepliktig)}</b>
                    </div>
                    <div className="kalk-rad">
                      <span>× Effektiv sats (22 % × 1,72)</span><b>{EFFEKTIV_SATS} %</b>
                    </div>
                    <div className="kalk-rad resultat">
                      <span>= Skatt å betale</span><b>{krDes(r.skatt)}</b>
                    </div>
                    {r.spart > 0 && (
                      <div className="kalk-spart">
                        Du sparer <b>{krDes(r.spart)}</b> i skatt takket være skjermingsfradraget.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="kalk-rad">
                      <span>× Effektiv sats (22 % × 1,72)</span><b>{EFFEKTIV_SATS} %</b>
                    </div>
                    <div className="kalk-rad resultat">
                      <span>= Skattebesparelse (fradrag)</span><b>{krDes(Math.abs(r.skattEffekt))}</b>
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            (type === 'vps' ? Number(utbytte) > 0 : Number(uttak) > 0) && (
              <div className="kalk-regnestykke">
                <div className="kalk-tittel">Hva du betaler i skatt</div>
                <div className="kalk-rad">
                  <span>{type === 'vps' ? 'Utbytte mottatt' : 'Uttak'}</span>
                  <b>{kr(type === 'vps' ? r.utbytte : r.uttak)}</b>
                </div>
                <div className="kalk-rad">
                  <span>− Skjermingsfradrag</span><b>−{krDes(Math.min(r.skjerming, type === 'vps' ? r.utbytte : r.uttak))}</b>
                </div>
                <div className="kalk-rad sum">
                  <span>= Skattepliktig</span><b>{krDes(r.skattepliktig)}</b>
                </div>
                <div className="kalk-rad">
                  <span>× Effektiv sats (22 % × 1,72)</span><b>{EFFEKTIV_SATS} %</b>
                </div>
                <div className="kalk-rad resultat">
                  <span>= Skatt å betale</span><b>{krDes(r.skatt)}</b>
                </div>

                {r.spart > 0 && (
                  <div className="kalk-spart">
                    Du sparer <b>{krDes(r.spart)}</b> i skatt takket være skjermingsfradraget.
                  </div>
                )}
              </div>
            )
          )}

          {type === 'salg' ? (
            harSalg && r.bortfaltSkjerming > 0 && (
              <div className="kalk-fremfor" style={{ background: '#FFF8EC', borderColor: '#F0E0C0' }}>
                <div className="kalk-fremfor-tittel" style={{ color: '#B5862F' }}>
                  {krDes(r.bortfaltSkjerming)} i skjerming går tapt
                </div>
                <p>
                  Skjerming kan bare redusere en gevinst til null — den kan aldri skape eller øke et tap,
                  og den kan ikke brukes mot andre aksjer. Siden du selger denne posisjonen, <b>fremføres den
                  ubrukte skjermingen ikke</b> til neste år slik den ville gjort ved utbytte — den bortfaller
                  for godt når du selger.
                </p>
              </div>
            )
          ) : (
            r.nyUbenyttet > 0 && (
              <div className="kalk-fremfor">
                <div className="kalk-fremfor-tittel">Du får med deg {krDes(r.nyUbenyttet)} videre</div>
                <p>
                  Skjermingen din var større enn {type === 'vps' ? 'utbyttet' : 'uttaket'}. Det som
                  ikke ble brukt, fremføres og <b>legges til skjermingsgrunnlaget neste år</b> — så
                  neste års skjerming blir høyere. Det gir en rentes-rente-effekt.
                </p>
                <div className="kalk-rad sum" style={{ marginTop: 10 }}>
                  <span>Skjermingsgrunnlag neste år</span><b>{kr(r.nyttGrunnlag)}</b>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="kalk-funksjoner">
        <h2>Kalkulatoren over regner ut én aksje av gangen. Gratis konto gjør det automatisk for hele porteføljen.</h2>
        <div className="kalk-funksjon-grid">
          <div className="kalk-funksjon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7"><path d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>
            <b>Skattemotor for hele porteføljen</b>
            <span>Skjermingsfradrag, gevinst ved salg og en logg over realiserte salg — regnet ut automatisk
              for hver aksje du eier, ikke bare én om gangen.</span>
          </div>
          <div className="kalk-funksjon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7"><path d="M12 3a5 5 0 0 1 5 5c0 2-1 3-1 5H8c0-2-1-3-1-5a5 5 0 0 1 5-5ZM9 18h6M10 21h4" /></svg>
            <b>Rådgiver</b>
            <span>Spør om din egen portefølje og dine egne skattetall. Forklarer sammensetning og risiko —
              anbefaler aldri kjøp eller salg.</span>
          </div>
          <div className="kalk-funksjon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7"><path d="M3 3h18v18H3zM3 9h18M9 21V9" /></svg>
            <b>Flere kontoer samtidig</b>
            <span>Importer VPS og ASK side om side fra megleren din, uten at den ene overskriver den andre.</span>
          </div>
        </div>
        <Link to="/login" className="btn kalk-funksjoner-cta">Opprett gratis konto</Link>
      </div>

      <div className="kalk-bunn">
        <div className="kalk-disclaimer">
          Dette er en forklaring, ikke skatterådgivning. Kontroller alltid mot{' '}
          <a href="https://www.skatteetaten.no/satser/skjermingsrente-for-aksjer-og-enkeltpersonforetak/"
            target="_blank" rel="noreferrer">Skatteetaten</a>. Skjermingsrenten for {SISTE_AAR} er {SKJERMINGSRENTE[SISTE_AAR]} %.
        </div>

        <div className="kalk-videre">
          <Link to="/skatteregler" className="kalk-kort">
            <b>Slik fungerer skjermingsfradraget</b>
            <span>Reglene forklart, med kilder fra Skatteetaten</span>
          </Link>
          <Link to="/login" className="kalk-kort">
            <b>Har du mange aksjer?</b>
            <span>Opprett gratis konto, importer porteføljen fra megleren din og se alt samlet</span>
          </Link>
        </div>
      </div>

      <Assistent />
    </div>
  )
}
