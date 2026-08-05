import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { hentPriser } from '../lib/prices'
import { beregnASK, beregnGevinstVedSalg, beregnFondGevinstVedSalg, kr, krDes, SISTE_AAR, EFFEKTIV_SATS } from '../lib/skattekalkulator'
import {
  beregnVPSPortefolje, hentSkjermingRader, lagreSkjerming, oppdaterVerdipapirType,
  beregnRealisertSalg, summerRealiserteSalg, hentRealiserteSalg, lagreRealisertSalg, slettRealisertSalg,
} from '../lib/skattemotor'
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

const FOND_SQL = `alter table posisjoner add column if not exists verdipapir_type text;
alter table posisjoner add column if not exists aksjeandel numeric;
alter table realiserte_salg add column if not exists er_fond boolean default false;
alter table realiserte_salg add column if not exists aksjeandel numeric;`

const REALISERT_SQL = `create table if not exists realiserte_salg (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id) on delete cascade,
  noekkel text not null,
  navn text not null,
  antall numeric not null,
  kostpris numeric not null,
  salgssum numeric not null,
  salgskurtasje numeric not null default 0,
  ubenyttet_skjerming numeric not null default 0,
  dato date not null,
  aar integer not null,
  opprettet timestamptz default now()
);

alter table realiserte_salg enable row level security;

drop policy if exists "egne realiserte salg" on realiserte_salg;
create policy "egne realiserte salg" on realiserte_salg
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
  const [kreditfradragOverstyrt, setKreditfradragOverstyrt] = useState({})
  const [apen, setApen] = useState(null)
  const [lagrer, setLagrer] = useState(false)
  const [lagretOk, setLagretOk] = useState(false)
  const [manglerTabell, setManglerTabell] = useState(false)

  // Fond (type/aksjeandel per posisjon)
  const [fondRediger, setFondRediger] = useState({})
  const [fondLagrer, setFondLagrer] = useState(null)
  const [fondFeil, setFondFeil] = useState('')
  const [manglerFondKolonner, setManglerFondKolonner] = useState(false)

  // Realiserte salg
  const [realiserteSalg, setRealiserteSalg] = useState([])
  const [manglerSalgTabell, setManglerSalgTabell] = useState(false)
  const [salgNoekkel, setSalgNoekkel] = useState('')
  const [salgAntall, setSalgAntall] = useState('')
  const [salgSum, setSalgSum] = useState('')
  const [salgKurtasje, setSalgKurtasje] = useState('')
  const [salgUbenyttet, setSalgUbenyttet] = useState('')
  const [salgUbenyttetTouched, setSalgUbenyttetTouched] = useState(false)
  const [salgAksjeandelKjop, setSalgAksjeandelKjop] = useState('')
  const [salgDato, setSalgDato] = useState(() => new Date().toISOString().slice(0, 10))
  const [salgLagrer, setSalgLagrer] = useState(false)
  const [salgFeil, setSalgFeil] = useState('')

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

      try {
        setRealiserteSalg(await hentRealiserteSalg(supabase))
      } catch (e) {
        if (avbrutt) { /* ignorer */ }
        else if (/could not find the table|does not exist/i.test(e.message)) setManglerSalgTabell(true)
        else setFeil('Fikk ikke hentet realiserte salg (' + e.message + ')')
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

  const { rader, utenKostpris, ikkeVPS, manglerAksjeandel } = useMemo(
    () => beregnVPSPortefolje({ posisjoner, prisdata, skjermingRader, utbytteOverstyrt, ubenyttetOverstyrt, kreditfradragOverstyrt }),
    [posisjoner, prisdata, skjermingRader, utbytteOverstyrt, ubenyttetOverstyrt, kreditfradragOverstyrt]
  )

  const salgValgtPosisjon = rader.find((x) => x.noekkel === salgNoekkel) || null
  const salgKostprisPerAksje = salgValgtPosisjon ? salgValgtPosisjon.r.inngangsverdi / salgValgtPosisjon.antall : 0

  // Ved salg av fond skal aksjeandelen være GJENNOMSNITTET av andelen i
  // kjøpsåret og salgsåret (Skatteetaten) — salgsårets andel er den vi
  // allerede har lagret på posisjonen (aksjeandel ved inntektsårets
  // begynnelse), kjøpsårets andel må brukeren oppgi selv.
  const salgAksjeandelSnitt = salgValgtPosisjon?.erFond && salgAksjeandelKjop !== ''
    ? (Number(salgAksjeandelKjop) + Number(salgValgtPosisjon.aksjeandel)) / 2
    : null

  // Foreslår ubenyttet skjerming proporsjonalt med hvor stor andel av
  // posisjonen som selges — brukeren kan alltid overstyre.
  useEffect(() => {
    if (salgUbenyttetTouched || !salgValgtPosisjon) return
    const antall = Number(salgAntall) || 0
    if (antall <= 0) return
    const andel = Math.min(1, antall / salgValgtPosisjon.antall)
    setSalgUbenyttet(String(Math.round(salgValgtPosisjon.r.ubenyttetInn * andel)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salgNoekkel, salgAntall])

  const salgForhandsvisning = salgValgtPosisjon && Number(salgAntall) > 0 && salgSum !== ''
    && (!salgValgtPosisjon.erFond || salgAksjeandelSnitt != null)
    ? (salgValgtPosisjon.erFond
        ? beregnFondGevinstVedSalg({
            kostpris: salgKostprisPerAksje * Number(salgAntall),
            salgssum: salgSum, salgskurtasje: salgKurtasje, ubenyttetSkjerming: salgUbenyttet,
            aksjeandel: salgAksjeandelSnitt, aar: SISTE_AAR,
          })
        : beregnGevinstVedSalg({
            kostpris: salgKostprisPerAksje * Number(salgAntall),
            salgssum: salgSum, salgskurtasje: salgKurtasje, ubenyttetSkjerming: salgUbenyttet, aar: SISTE_AAR,
          }))
    : null

  const realisertTotal = useMemo(() => summerRealiserteSalg(realiserteSalg), [realiserteSalg])

  function nullstillSalgSkjema() {
    setSalgNoekkel(''); setSalgAntall(''); setSalgSum(''); setSalgKurtasje('')
    setSalgUbenyttet(''); setSalgUbenyttetTouched(false); setSalgAksjeandelKjop('')
    setSalgDato(new Date().toISOString().slice(0, 10))
  }

  async function handleLagreSalg() {
    if (!user || !salgValgtPosisjon) return
    if (salgValgtPosisjon.erFond && salgAksjeandelSnitt == null) {
      setSalgFeil('Fyll inn aksjeandelen ved kjøp før du registrerer salget.')
      return
    }
    setSalgLagrer(true); setSalgFeil('')
    try {
      await lagreRealisertSalg(supabase, user.id, {
        noekkel: salgValgtPosisjon.noekkel,
        navn: salgValgtPosisjon.navn,
        antall: Number(salgAntall),
        kostpris: salgKostprisPerAksje * Number(salgAntall),
        salgssum: Number(salgSum) || 0,
        salgskurtasje: Number(salgKurtasje) || 0,
        ubenyttet_skjerming: Number(salgUbenyttet) || 0,
        dato: salgDato,
        aar: SISTE_AAR,
        er_fond: salgValgtPosisjon.erFond,
        aksjeandel: salgValgtPosisjon.erFond ? salgAksjeandelSnitt : null,
      })
      setRealiserteSalg(await hentRealiserteSalg(supabase))
      nullstillSalgSkjema()
    } catch (e) {
      if (/(er_fond|aksjeandel)/i.test(e.message) && /(does not exist|could not find)/i.test(e.message)) setManglerFondKolonner(true)
      else setSalgFeil(e.message)
    } finally {
      setSalgLagrer(false)
    }
  }

  async function handleSlettSalg(id) {
    setSalgFeil('')
    try {
      await slettRealisertSalg(supabase, id)
      setRealiserteSalg(await hentRealiserteSalg(supabase))
    } catch (e) {
      setSalgFeil(e.message)
    }
  }

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

  function startFondRediger(x) {
    setFondFeil('')
    setFondRediger((s) => ({
      ...s,
      [x.noekkel]: s[x.noekkel] !== undefined
        ? s[x.noekkel]
        : { type: x.erFond ? 'fond' : 'aksje', aksjeandel: x.aksjeandel != null ? String(x.aksjeandel) : '' },
    }))
  }

  async function handleLagreFondType(x) {
    const rediger = fondRediger[x.noekkel]
    if (!rediger || !user) return
    if (rediger.type === 'fond' && rediger.aksjeandel === '') {
      setFondFeil('Fyll inn aksjeandelen (0–100) før du lagrer.')
      return
    }
    setFondLagrer(x.noekkel); setFondFeil('')
    try {
      await oppdaterVerdipapirType(supabase, user.id, { isin: x.isin, navn: x.navn }, {
        verdipapirType: rediger.type,
        aksjeandel: rediger.type === 'fond' ? Number(rediger.aksjeandel) : null,
      })
      const { data } = await supabase.from('posisjoner').select('*').order('markedsverdi', { ascending: false })
      setPosisjoner(data || [])
      setFondRediger((s) => { const n = { ...s }; delete n[x.noekkel]; return n })
      setManglerFondKolonner(false)
    } catch (e) {
      if (/(verdipapir_type|aksjeandel)/i.test(e.message) && /(does not exist|could not find)/i.test(e.message)) setManglerFondKolonner(true)
      else setFondFeil(e.message)
    } finally {
      setFondLagrer(null)
    }
  }

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

      {manglerFondKolonner && (
        <div className="kalk-fremfor" style={{ marginBottom: 18 }}>
          <div className="kalk-fremfor-tittel">Én rask ting i Supabase, så kan du merke fondsandeler</div>
          <p>
            Å merke en posisjon som fond krever to nye kolonner på posisjoner-tabellen som ikke finnes i
            prosjektet ditt ennå. Lim inn dette i Supabase → SQL Editor → Run (kun én gang):
          </p>
          <pre className="motor-sql">{FOND_SQL}</pre>
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
                  <tr className="motor-rad" onClick={() => {
                    const vilApne = apen !== x.noekkel
                    setApen(vilApne ? x.noekkel : null)
                    if (vilApne) startFondRediger(x)
                  }}>
                    <td><div className="tick"><span className="nm">{x.navn}</span>{x.erFond && <span className="motor-fond-merke">Fond</span>}</div></td>
                    <td className="r mono">{kr(x.r.inngangsverdi)}</td>
                    <td className="r mono" onClick={(e) => e.stopPropagation()}>
                      <span className="motor-utbytte-felt">
                        <TallInput
                          verdi={x.utbytteFelt}
                          onChange={(v) => setUtbytteOverstyrt((s) => ({ ...s, [x.noekkel]: v }))}
                          placeholder="0"
                        />
                        {x.fantData && !x.dekkerHeleAaret && (
                          <span
                            className="motor-ufullstendig-merke"
                            title={`Utbyttehistorikken dekker bare 12 måneder tilbake i tid — kan mangle utbetalinger tidlig i ${SISTE_AAR} for akkurat denne aksjen. Sjekk mot årsoppgaven fra megler.`}
                          >!</span>
                        )}
                      </span>
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
                          {x.erFond && (
                            <>
                              <div className="kalk-rad"><span>　– herav aksjedel ({x.r.aksjeandel} % av fondet)</span><b>{kr(x.r.aksjedelUtbytte)}</b></div>
                              <div className="kalk-rad"><span>　– herav rentedel</span><b>{kr(x.r.rentedelUtbytte)}</b></div>
                            </>
                          )}
                          <div className="kalk-rad"><span>− Skjermingsfradrag{x.erFond && ' (kun mot aksjedelen)'}</span><b>−{krDes(x.r.brukt)}</b></div>
                          {x.erFond && x.r.rentedelUtbytte > 0 && (
                            <div className="kalk-rad"><span>+ Skatt på rentedel (22 %, ingen skjerming)</span><b>{krDes(x.r.rentedelSkatt)}</b></div>
                          )}
                          <div className="kalk-rad sum"><span>= Skattepliktig</span><b>{krDes(x.r.skattepliktig)}</b></div>
                          {!x.erFond && (
                            <>
                              <div className="kalk-rad"><span>= Skatt før kreditfradrag ({EFFEKTIV_SATS} %)</span><b>{krDes(x.r.skattFoerKredit)}</b></div>
                              <div className="kalk-felt" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                                <label>
                                  Kreditfradrag for utenlandsk kildeskatt
                                  <span className="kalk-valgfri">valgfritt</span>
                                </label>
                                <div className="kalk-hjelp">
                                  Kildeskatt trukket av utenlandsk megler/myndighet, begrenset til skatteavtalens sats
                                  (f.eks. 15 % for USA) — ikke nødvendigvis alt som ble trukket. Trekkes fra norsk
                                  skatt på dette utbyttet, aldri under 0.
                                </div>
                                <div className="kalk-input">
                                  <input type="number" inputMode="decimal"
                                    value={x.kreditfradragFelt}
                                    onChange={(e) => setKreditfradragOverstyrt((s) => ({ ...s, [x.noekkel]: e.target.value }))}
                                    placeholder="0" />
                                  <span className="kalk-enhet">kr</span>
                                </div>
                              </div>
                              {x.r.kreditfradragUbrukt > 0 && (
                                <div className="import-hint" style={{ marginTop: 10 }}>
                                  {krDes(x.r.kreditfradragUbrukt)} av kreditfradraget kunne ikke brukes i år, siden det
                                  oversteg norsk skatt på dette utbyttet. Fremføring til senere år (inntil 5 år) er
                                  ikke støttet automatisk her ennå — sjekk om du kan kreve det i skattemeldingen selv.
                                </div>
                              )}
                            </>
                          )}
                          <div className="kalk-rad resultat"><span>= Skatt å betale</span><b>{krDes(x.r.skatt)}</b></div>
                          {x.r.nyUbenyttet > 0 && (
                            <div className="kalk-rad" style={{ marginTop: 10 }}><span>Ubenyttet skjerming videre til {SISTE_AAR + 1}</span><b>{kr(x.r.nyUbenyttet)}</b></div>
                          )}
                          {!x.fantData && <div className="import-hint" style={{ marginTop: 10 }}>Fant ikke utbyttehistorikk automatisk for denne aksjen — utbytte må fylles inn manuelt.</div>}
                        </div>

                        {fondRediger[x.noekkel] && (
                          <div className="kalk-regnestykke motor-detalj" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                            <div className="kalk-tittel">Type verdipapir</div>
                            <select className="kalk-select" value={fondRediger[x.noekkel].type}
                              onChange={(e) => setFondRediger((s) => ({ ...s, [x.noekkel]: { ...s[x.noekkel], type: e.target.value } }))}>
                              <option value="aksje">Aksje / rent aksjefond (aksjeandel over 80 %)</option>
                              <option value="fond">Fond med kjent aksjeandel (kombinasjons-/rentefond)</option>
                            </select>
                            {fondRediger[x.noekkel].type === 'fond' && (
                              <div className="kalk-felt" style={{ marginTop: 10 }}>
                                <label>Aksjeandel i fondet ved inntektsårets begynnelse</label>
                                <div className="kalk-hjelp">
                                  Finnes i fondets årsrapport eller hos forvalter. Under 20 % skattlegges alt som
                                  renteinntekt (22 %), over 80 % som aksjeutbytte, 20–80 % splittes forholdsmessig.
                                </div>
                                <div className="kalk-input">
                                  <input type="number" inputMode="decimal" min="0" max="100"
                                    value={fondRediger[x.noekkel].aksjeandel}
                                    onChange={(e) => setFondRediger((s) => ({ ...s, [x.noekkel]: { ...s[x.noekkel], aksjeandel: e.target.value } }))}
                                    placeholder="0-100" />
                                  <span className="kalk-enhet">%</span>
                                </div>
                              </div>
                            )}
                            {fondFeil && <div className="import-feil" style={{ marginTop: 10 }}>{fondFeil}</div>}
                            <button type="button" className="btn ghost" style={{ marginTop: 10 }}
                              disabled={fondLagrer === x.noekkel}
                              onClick={() => handleLagreFondType(x)}>
                              {fondLagrer === x.noekkel ? 'Lagrer …' : 'Lagre type'}
                            </button>
                          </div>
                        )}

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

      {type === 'vps' && ikkeVPS.length > 0 && (
        askResultat ? (
          <div className="muted-note">
            {ikkeVPS.length} posisjon{ikkeVPS.length > 1 ? 'er' : ''} ligger på en konto merket ASK og regnes ut i
            ASK-fanen i stedet: {ikkeVPS.map((p) => p.navn).join(', ')}.
          </div>
        ) : (
          <div className="kalk-import-disclaimer" style={{ marginBottom: 18 }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            <div>
              {ikkeVPS.length} posisjon{ikkeVPS.length > 1 ? 'er' : ''} ligger på en konto merket ASK, men du har ikke
              lagt inn kontoutdrag i ASK-fanen ennå — akkurat nå får du derfor <b>ingen skjermingsfradrag</b> for
              dem: {ikkeVPS.map((p) => p.navn).join(', ')}. Er du sikker på at kontoen faktisk er en
              aksjesparekonto (ASK), og ikke en vanlig aksjekonto (VPS) som ble feilmerket ved import? Sjekk
              kontotypen under «Kontoer» i <Link to="/app/portefolje">Min portefølje</Link> hvis du er usikker —
              er den feilmerket, kan du bytte den der. Er den riktig merket, fyll inn kontoutdraget i ASK-fanen for
              å faktisk få skjermingsfradraget ditt.
            </div>
          </div>
        )
      )}

      {type === 'vps' && manglerAksjeandel.length > 0 && (
        <div className="muted-note">
          {manglerAksjeandel.length} posisjon{manglerAksjeandel.length > 1 ? 'er' : ''} er merket som fond, men
          mangler aksjeandel-prosenten og er ikke tatt med i skjermingsberegningen:{' '}
          {manglerAksjeandel.map((p) => p.navn).join(', ')}. Åpne posisjonen for å fylle den inn.
        </div>
      )}

      {type === 'vps' && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-h">
            <h2>Realiserte salg {SISTE_AAR}</h2>
            <span className="hint">Faktiske salg, ikke en hypotese</span>
          </div>

          {manglerSalgTabell && (
            <div className="kalk-fremfor" style={{ marginBottom: 18 }}>
              <div className="kalk-fremfor-tittel">Én rask ting i Supabase, så lagres realiserte salg</div>
              <p>
                Realiserte salg lagres i en egen tabell som ikke finnes i prosjektet ditt ennå. Lim inn dette i
                Supabase → SQL Editor → Run (kun én gang):
              </p>
              <pre className="motor-sql">{REALISERT_SQL}</pre>
            </div>
          )}

          {realiserteSalg.length > 0 && (
            <>
              <table className="holdings" style={{ marginBottom: 18 }}>
                <thead>
                  <tr>
                    <th>Aksje</th><th className="r">Dato</th><th className="r">Antall</th>
                    <th className="r">Gevinst/tap</th><th className="r">Skatt</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {realiserteSalg.map((salg) => {
                    const g = beregnRealisertSalg(salg)
                    return (
                      <tr key={salg.id}>
                        <td><span className="nm">{salg.navn}</span>{salg.er_fond && <span className="motor-fond-merke">Fond</span>}</td>
                        <td className="r mono">{salg.dato}</td>
                        <td className="r mono">{salg.antall}</td>
                        <td className="r mono">{g.erGevinst ? kr(g.gevinstFoerSkjerming) : kr(g.tap)}</td>
                        <td className="r mono">{g.erGevinst ? krDes(g.skatt) : '−' + krDes(Math.abs(g.skattEffekt))}</td>
                        <td className="r">
                          <button type="button" className="btn ghost" style={{ padding: '6px 12px', fontSize: 13 }}
                            onClick={() => handleSlettSalg(salg.id)}>
                            Slett
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="kalk-regnestykke" style={{ marginBottom: 18 }}>
                <div className="kalk-rad sum"><span>Realisert gevinst/tap totalt</span><b>{kr(realisertTotal.gevinstFoerSkjerming)}</b></div>
                <div className="kalk-rad"><span>Skattepliktig etter skjerming</span><b>{krDes(realisertTotal.skattepliktig)}</b></div>
                <div className="kalk-rad resultat"><span>Skatt/skattebesparelse totalt</span><b>{krDes(realisertTotal.skattEffekt)}</b></div>
                {realisertTotal.bortfaltSkjerming > 0 && (
                  <div className="import-hint" style={{ marginTop: 10 }}>
                    {krDes(realisertTotal.bortfaltSkjerming)} i skjerming har gått tapt på disse salgene.
                  </div>
                )}
              </div>
            </>
          )}

          <div className="kalk-tittel" style={{ marginBottom: 10 }}>Registrer et salg</div>
          <div className="konto-velger" style={{ marginBottom: 0 }}>
            <select className="kalk-select konto-type-select" style={{ flex: '1 1 220px' }}
              value={salgNoekkel} onChange={(e) => { setSalgNoekkel(e.target.value); setSalgUbenyttetTouched(false) }}>
              <option value="">— velg aksje —</option>
              {rader.map((x) => (
                <option key={x.noekkel} value={x.noekkel}>{x.navn}{x.erFond ? ' (fond)' : ''} ({x.antall} stk eid)</option>
              ))}
            </select>
          </div>
          {salgValgtPosisjon && (
            <>
              <Felt label="Antall solgt" verdi={salgAntall} setVerdi={setSalgAntall} enhet="stk" />
              {salgValgtPosisjon.erFond && (
                <>
                  <Felt label="Aksjeandel ved kjøp"
                    hjelp="Fondets aksjeandel det året du kjøpte andelene — finnes i fondets årsrapport for det året. Gjennomsnittet av denne og aksjeandelen ved salg (i dag lagret på posisjonen) brukes til å splitte gevinsten."
                    verdi={salgAksjeandelKjop} setVerdi={setSalgAksjeandelKjop} enhet="%" />
                  {salgAksjeandelSnitt != null && (
                    <div className="muted-note">Gjennomsnittlig aksjeandel brukt i beregningen: {salgAksjeandelSnitt.toFixed(1)} %</div>
                  )}
                </>
              )}
              {Number(salgAntall) > 0 && Number(salgAntall) < salgValgtPosisjon.antall && (
                <div className="kalk-import-disclaimer">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                  <div>
                    Du selger en DEL av posisjonen. Kostprisen under bruker vektet snitt-GAV for hele posisjonen,
                    ikke FIFO (eldste aksjer selges først) som Skatteetaten krever ved delsalg. Har du kjøpt disse
                    aksjene på ulike tidspunkt til ulike priser, kan riktig skattetall avvike noe fra dette —
                    kontroller mot kjøpshistorikken din. Selger du hele posisjonen er tallet korrekt uansett.
                  </div>
                </div>
              )}
              <Felt label="Salgssum" hjelp="Det du solgte aksjene for" verdi={salgSum} setVerdi={setSalgSum} />
              <Felt label="Kurtasje ved salg" verdi={salgKurtasje} setVerdi={setSalgKurtasje} valgfri />
              <Felt label="Ubenyttet skjerming brukt"
                hjelp="Foreslått proporsjonalt med hvor mye av posisjonen du selger — kan overstyres."
                verdi={salgUbenyttet} setVerdi={(v) => { setSalgUbenyttetTouched(true); setSalgUbenyttet(v) }} valgfri />
              <Felt label="Salgsdato" verdi={salgDato} setVerdi={setSalgDato} type="date" enhet="" />

              {salgForhandsvisning && (
                <div className="kalk-regnestykke" style={{ marginTop: 16 }}>
                  <div className="kalk-tittel">Slik regnes salget ut</div>
                  <div className="kalk-rad"><span>Salgssum</span><b>{kr(salgForhandsvisning.salgssum)}</b></div>
                  <div className="kalk-rad"><span>− Kostpris</span><b>−{kr(salgForhandsvisning.inngangsverdi)}</b></div>
                  <div className="kalk-rad sum">
                    <span>= {salgForhandsvisning.erGevinst ? 'Gevinst før skjerming' : 'Tap'}</span>
                    <b>{salgForhandsvisning.erGevinst ? kr(salgForhandsvisning.gevinstFoerSkjerming) : kr(salgForhandsvisning.tap)}</b>
                  </div>
                  {salgValgtPosisjon.erFond && salgForhandsvisning.aksjeandel <= 80 && (
                    <>
                      <div className="kalk-rad"><span>　– herav aksjedel ({salgForhandsvisning.aksjeandel.toFixed(1)} %)</span><b>{kr(salgForhandsvisning.aksjedelGevinst)}</b></div>
                      <div className="kalk-rad"><span>　– herav rentedel</span><b>{kr(salgForhandsvisning.rentedelGevinst)}</b></div>
                    </>
                  )}
                  {salgForhandsvisning.erGevinst ? (
                    <>
                      <div className="kalk-rad"><span>− Skjermingsfradrag brukt{salgValgtPosisjon.erFond && ' (kun mot aksjedelen)'}</span><b>−{krDes(salgForhandsvisning.brukt)}</b></div>
                      {salgValgtPosisjon.erFond && salgForhandsvisning.rentedelGevinst > 0 && (
                        <div className="kalk-rad"><span>+ Skatt på rentedel (22 %, ingen skjerming)</span><b>{krDes(salgForhandsvisning.rentedelSkattEffekt)}</b></div>
                      )}
                      <div className="kalk-rad sum"><span>= Skattepliktig gevinst</span><b>{krDes(salgForhandsvisning.skattepliktig)}</b></div>
                      <div className="kalk-rad resultat"><span>= Skatt å betale</span><b>{krDes(salgForhandsvisning.skatt)}</b></div>
                    </>
                  ) : (
                    <div className="kalk-rad resultat"><span>= Skattebesparelse (fradrag)</span><b>{krDes(Math.abs(salgForhandsvisning.skattEffekt))}</b></div>
                  )}
                  {salgForhandsvisning.bortfaltSkjerming > 0 && (
                    <div className="import-hint" style={{ marginTop: 10 }}>
                      {krDes(salgForhandsvisning.bortfaltSkjerming)} i skjerming bortfaller ved dette salget.
                    </div>
                  )}
                </div>
              )}

              {salgFeil && <div className="import-feil" style={{ marginTop: 14 }}>{salgFeil}</div>}
              <button className="btn" style={{ marginTop: 14 }}
                disabled={salgLagrer || !salgAntall || !salgSum || (salgValgtPosisjon.erFond && salgAksjeandelSnitt == null)}
                onClick={handleLagreSalg}>
                {salgLagrer ? 'Lagrer …' : 'Registrer salget'}
              </button>
            </>
          )}
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
              <div className="kalk-hjelp">Last opp transaksjonseksporten fra megleren din, så regner vi ut laveste innskuddssaldo og uttak automatisk.</div>
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
                  dekker resten av {SISTE_AAR} uten hull. Interne overføringer mellom dine egne kontoer telles
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

function Felt({ label, hjelp, verdi, setVerdi, valgfri, enhet = 'kr', type = 'number' }) {
  return (
    <div className="kalk-felt">
      <label>
        {label}
        {valgfri && <span className="kalk-valgfri">valgfritt</span>}
      </label>
      {hjelp && <div className="kalk-hjelp">{hjelp}</div>}
      <div className="kalk-input">
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={verdi}
          onChange={(e) => setVerdi(e.target.value)}
          placeholder={type === 'number' ? '0' : undefined}
        />
        {enhet && <span className="kalk-enhet">{enhet}</span>}
      </div>
    </div>
  )
}
