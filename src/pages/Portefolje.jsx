import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseNordnetCSV } from '../lib/nordnet'
import { finnSektor, SEKTOR_FARGE } from '../lib/sectors'
import { beregnPortefolje, formaterKr, formaterPst, formaterUtbytteMelding } from '../lib/portfolio'
import { hentPriser } from '../lib/prices'
import { oppdagRom, sendRomMelding } from '../lib/rooms'
import Band from '../components/Band'

function KontoVelgerFelt({ nyKontoNavn, setNyKontoNavn, nyKontoType, endreKontoType, vpsBekreftet, setVpsBekreftet, navnPlaceholder }) {
  return (
    <>
      <div className="konto-velger">
        <input type="text" className="konto-navn-input" value={nyKontoNavn} onChange={(e) => setNyKontoNavn(e.target.value)} placeholder={navnPlaceholder} />
        <select className="kalk-select konto-type-select" value={nyKontoType} onChange={(e) => endreKontoType(e.target.value)}>
          <option value="vps">Vanlig konto (VPS)</option>
          <option value="ask">Aksjesparekonto (ASK)</option>
        </select>
      </div>
      {nyKontoType === 'vps' && (
        <label className="konto-vps-bekreft">
          <input type="checkbox" checked={vpsBekreftet} onChange={(e) => setVpsBekreftet(e.target.checked)} />
          <span>
            Jeg bekrefter at dette er en vanlig aksjekonto (VPS), der kostpris brukes som
            skjermingsgrunnlag — ikke en aksjesparekonto (ASK). Velger du feil her, kan
            skattetallet i Min skatt bli galt uten varsel.
          </span>
        </label>
      )}
    </>
  )
}

export default function Portefolje() {
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [posisjoner, setPosisjoner] = useState([])
  const [lasterData, setLasterData] = useState(true)
  const [importerer, setImporterer] = useState(false)
  const [feil, setFeil] = useState('')
  const [prisdata, setPrisdata] = useState(null)
  const [oppdaterer, setOppdaterer] = useState(false)
  const [prisFeil, setPrisFeil] = useState('')
  const [sistOppdatert, setSistOppdatert] = useState(null)
  const [importStatus, setImportStatus] = useState('')
  const [nyKontoNavn, setNyKontoNavn] = useState('VPS')
  const [nyKontoType, setNyKontoType] = useState('vps')
  const [vpsBekreftet, setVpsBekreftet] = useState(false)
  const [slettKontoNavn, setSlettKontoNavn] = useState(null)
  const [sletterKonto, setSletterKonto] = useState(false)
  const [delPos, setDelPos] = useState(null)
  const [mineRomDel, setMineRomDel] = useState([])
  const [lasterRomDel, setLasterRomDel] = useState(false)
  const [delRomId, setDelRomId] = useState('')
  const [deler, setDeler] = useState(false)
  const [delFeil, setDelFeil] = useState('')
  const [delSuksess, setDelSuksess] = useState(false)

  // VPS kjører en automatisk, konkret skatteberegning (kostpris som skjermingsgrunnlag) —
  // ASK utelates bare fra Min skatt til brukeren sjekker det. Feilmerking i VPS-retning
  // kan derfor gi et stille, galt skattetall, mens feilmerking i ASK-retning bare gir en
  // manglende beregning. Krev derfor en bevisst bekreftelse KUN for VPS.
  function endreKontoType(type) {
    setNyKontoType(type)
    setVpsBekreftet(false)
  }

  async function lastPosisjoner() {
    setLasterData(true)
    const { data, error } = await supabase.from('posisjoner').select('*').order('markedsverdi', { ascending: false })
    if (error) setFeil(error.message)
    setPosisjoner(data || [])
    setLasterData(false)
    return data || []
  }
  async function oppdaterPriser(pos) {
    if (!pos || pos.length === 0) return
    setOppdaterer(true); setPrisFeil('')
    try { const data = await hentPriser(pos); setPrisdata(data); setSistOppdatert(new Date()) }
    catch (err) { setPrisFeil('Fikk ikke hentet live kurser — viser verdier fra import. (' + (err?.message || String(err)) + ')') }
    finally { setOppdaterer(false) }
  }
  useEffect(() => { lastPosisjoner().then((d) => oppdaterPriser(d)) /* eslint-disable-next-line */ }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const kontoNavn = nyKontoNavn.trim() || 'VPS'
    // Sikkerhetssperre: VPS skal aldri importeres uten bekreftelse, uansett hvilken
    // knapp som trigget filvalget. Knappene er allerede disabled i dette tilfellet,
    // så dette bør aldri inntreffe i praksis — men stopper importen i stedet for å
    // stille lagre en potensielt feilmerket konto, om det likevel skjer.
    if (nyKontoType === 'vps' && !vpsBekreftet) {
      setFeil('Du må bekrefte at dette er en VPS-konto før du kan importere den.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFeil(''); setImportStatus(''); setImporterer(true)
    try {
      const buf = await file.arrayBuffer()
      const { positions } = parseNordnetCSV(buf)
      const rader = positions.map((p) => ({
        bruker_id: user.id, navn: p.navn, isin: p.isin, ticker: null, sektor: finnSektor(p.navn),
        antall: p.antall, markedsverdi: p.markedsverdi, gav: p.gav, konto: kontoNavn, konto_type: nyKontoType,
      }))
      // Sletter KUN posisjoner på denne kontoen — andre importerte kontoer (f.eks.
      // en ASK ved siden av en VPS) skal ikke røres.
      const { data: slettet, error: delErr } = await supabase.from('posisjoner').delete()
        .eq('bruker_id', user.id).eq('konto', kontoNavn).select('id')
      if (delErr) throw new Error(delErr.message)
      const { error: insErr } = await supabase.from('posisjoner').insert(rader)
      if (insErr) throw new Error(insErr.message)
      const d = await lastPosisjoner(); oppdaterPriser(d)
      setImportStatus(
        `Fila hadde ${positions.length} rad(er) for kontoen «${kontoNavn}». Slettet ${slettet?.length ?? 0} gamle ` +
        `posisjon(er) på denne kontoen, la til ${rader.length} nye. Du har nå ${d.length} posisjon(er) totalt på tvers av alle kontoer.`
      )
    } catch (err) { setFeil(err.message) }
    finally { setImporterer(false); setVpsBekreftet(false); if (fileRef.current) fileRef.current.value = '' }
  }

  function startImportForKonto(navn, type) {
    setNyKontoNavn(navn)
    setNyKontoType(type || 'vps')
    setVpsBekreftet(false)
    // ASK er det myke, friksjonsfrie valget — hopp rett til filvalg som før.
    // VPS krever en bevisst bekreftelse først, så her lar vi brukeren se og
    // huke av boksen i skjemaet under, i stedet for å hoppe forbi den.
    if (type !== 'vps') fileRef.current?.click()
  }

  async function slettKonto(navn) {
    setSletterKonto(true); setFeil('')
    try {
      const { error } = await supabase.from('posisjoner').delete().eq('bruker_id', user.id).eq('konto', navn)
      if (error) throw new Error(error.message)
      const d = await lastPosisjoner()
      oppdaterPriser(d)
      setImportStatus(`Slettet kontoen «${navn}».`)
      setSlettKontoNavn(null)
    } catch (err) {
      setFeil(err.message)
    } finally {
      setSletterKonto(false)
    }
  }

  async function apneDel(p) {
    setDelPos(p); setDelFeil(''); setDelSuksess(false); setDelRomId('')
    setLasterRomDel(true)
    try {
      const alle = await oppdagRom()
      setMineRomDel(alle.filter((r) => r.er_medlem))
    } catch (err) {
      setDelFeil(err.message)
    } finally {
      setLasterRomDel(false)
    }
  }

  function lukkDel() { setDelPos(null) }

  async function delTilRom() {
    if (!delPos || !delRomId) return
    const tekst = formaterUtbytteMelding(delPos)
    if (!tekst) return
    setDeler(true); setDelFeil('')
    try {
      await sendRomMelding(user.id, delRomId, tekst)
      setDelSuksess(true)
    } catch (err) {
      setDelFeil(err.message)
    } finally {
      setDeler(false)
    }
  }

  const pf = useMemo(() => beregnPortefolje(posisjoner, prisdata), [posisjoner, prisdata])

  const kontoer = useMemo(() => {
    const map = new Map()
    for (const p of pf.posisjoner) {
      const navn = p.konto || 'Ukjent konto'
      if (!map.has(navn)) map.set(navn, { navn, type: p.konto_type || 'vps', antall: 0, verdi: 0 })
      const g = map.get(navn)
      g.antall++
      g.verdi += p.liveVerdi || 0
    }
    return [...map.values()]
  }, [pf])

  if (lasterData) return (<div className="page"><div className="page-head"><h1>Min portefølje</h1></div><div className="muted-note">Laster …</div></div>)

  if (posisjoner.length === 0) return (
    <div className="page">
      <div className="page-head"><h1>Min portefølje</h1><p className="page-sub">Innlogget som {user?.email}</p></div>
      <div className="import-card">
        <div className="import-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg></div>
        <h2>Importer porteføljen din</h2>
        <p>Last opp en CSV med aksjebeholdningen din fra megleren din (f.eks. Nordnet eller DNB), så viser vi sammensetningen din som et sektorfarget bånd — ditt eget fingeravtrykk.</p>
        {feil && <div className="import-feil">{feil}</div>}
        <KontoVelgerFelt
          nyKontoNavn={nyKontoNavn} setNyKontoNavn={setNyKontoNavn}
          nyKontoType={nyKontoType} endreKontoType={endreKontoType}
          vpsBekreftet={vpsBekreftet} setVpsBekreftet={setVpsBekreftet}
          navnPlaceholder="Kontonavn, f.eks. VPS Nordnet"
        />
        <button className="btn" disabled={importerer || (nyKontoType === 'vps' && !vpsBekreftet)}
          onClick={() => fileRef.current?.click()}>
          {importerer ? 'Importerer …' : 'Velg CSV-fil'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
        <div className="import-hint">
          Nordnet: Depot → Beholdning → last ned som CSV. Andre meglere: se etter «eksporter»/«last ned» på
          beholdningssiden din. Vi gjenkjenner de vanligste kolonnenavnene automatisk — passer det ikke, får du
          en tydelig feilmelding i stedet for gale tall.
        </div>
      </div>
    </div>)

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div><h1>Min portefølje</h1><p className="page-sub">{pf.antall} posisjoner · {pf.harLive ? 'live kurser ' + (sistOppdatert ? sistOppdatert.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '') : 'verdier fra import'}</p></div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn ghost" disabled={oppdaterer} onClick={() => oppdaterPriser(posisjoner)}>{oppdaterer ? 'Oppdaterer …' : 'Oppdater kurser'}</button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
      </div>
      {feil && <div className="import-feil" style={{ marginBottom: 16 }}>{feil}</div>}
      {prisFeil && <div className="import-feil" style={{ marginBottom: 16 }}>{prisFeil}</div>}
      {importStatus && <div className="kalk-import-ok" style={{ marginBottom: 16 }}>{importStatus}</div>}
      <div className="metrics">
        <div className="metric"><div className="k">Markedsverdi</div><div className="v">{formaterKr(pf.total)}</div><div className="d">{pf.harLive ? 'Live' : 'Ved import'}</div></div>
        <div className="metric"><div className="k">Direkteavkastning</div><div className="v">{formaterPst(pf.direkteavkastning)}</div><div className="d">{pf.direkteavkastning != null ? 'Vektet · siste 12 mnd' : 'Krever live kurser'}</div></div>
        <div className="metric"><div className="k">Urealisert</div><div className={'v ' + (pf.gevinst == null ? '' : pf.gevinst >= 0 ? 'up' : 'down')}>{pf.gevinst == null ? '–' : formaterKr(pf.gevinst)}</div><div className="d">{pf.gevinstPst == null ? 'GAV mangler i fila' : formaterPst(pf.gevinstPst, true)}</div></div>
        <div className="metric"><div className="k">Posisjoner</div><div className="v">{pf.antall}</div><div className="d">{pf.sektorer.length} sektorer</div></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Kontoer</h2><span className="hint">Importer flere kontoer uten at de sletter hverandre</span></div>
        <table className="holdings" style={{ marginBottom: 18 }}>
          <thead><tr><th>Konto</th><th>Type</th><th className="r">Posisjoner</th><th className="r">Verdi</th><th></th></tr></thead>
          <tbody>
            {kontoer.map((k) => (
              <tr key={k.navn}>
                <td><span className="nm">{k.navn}</span></td>
                <td>{k.type === 'ask' ? 'Aksjesparekonto (ASK)' : 'Vanlig konto (VPS)'}</td>
                <td className="r mono">{k.antall}</td>
                <td className="r mono">{formaterKr(k.verdi)}</td>
                <td className="r">
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn ghost" style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={importerer} onClick={() => startImportForKonto(k.navn, k.type)}>
                      Importer på nytt
                    </button>
                    <button type="button" className="btn ghost" style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={importerer} onClick={() => setSlettKontoNavn(k.navn)}>
                      Slett
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <KontoVelgerFelt
          nyKontoNavn={nyKontoNavn} setNyKontoNavn={setNyKontoNavn}
          nyKontoType={nyKontoType} endreKontoType={endreKontoType}
          vpsBekreftet={vpsBekreftet} setVpsBekreftet={setVpsBekreftet}
          navnPlaceholder="Kontonavn, f.eks. ASK Nordnet"
        />
        <button className="btn ghost" style={{ marginTop: 10 }}
          disabled={importerer || (nyKontoType === 'vps' && !vpsBekreftet)}
          onClick={() => fileRef.current?.click()}>
          {importerer ? 'Importerer …' : 'Legg til konto'}
        </button>
        <div className="import-hint" style={{ marginTop: 8 }}>
          Skriv inn samme kontonavn som en konto over for å erstatte den, eller et nytt navn for å legge til en ny konto ved siden av.
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><h2>Sammensetning</h2><span className="hint">Hold over et felt</span></div>
        <Band sektorer={pf.sektorer} />
        <div className="legend">{pf.sektorer.map((s) => (<div key={s.sektor} className="legend-item"><span className="sw" style={{ background: s.farge }} />{s.navn} <b>{s.vekt.toFixed(0)}%</b></div>))}</div>
        <div className="comp-note"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>Andre vil se sammensetningen din i prosent — aldri kronebeløp.</div>
      </div>
      {pf.kalender && pf.aarligUtbytte > 0 && (
        <div className="panel">
          <div className="panel-h"><h2>Utbytte siste 12 måneder</h2><span className="hint">Med dagens beholdning</span></div>
          <div className="divcal">{pf.kalender.map((k) => (<div key={k.mnd} className="m"><div className={'bar' + (k.belop > 0 ? ' has' : '')} style={{ height: Math.max(k.andel, 4) + '%' }} title={formaterKr(k.belop)} /><div className="lbl">{k.mnd}</div></div>))}</div>
          <div className="div-sum"><span>Årlig utbytte, dagens beholdning</span><b>{formaterKr(pf.aarligUtbytte)}</b></div>
        </div>)}
      <div className="panel">
        <div className="panel-h"><h2>Beholdning</h2></div>
        <table className="holdings">
          <thead><tr><th>Aksje</th><th className="r">Antall</th><th className="r">Markedsverdi</th><th className="r">Dir.avk.</th><th className="r">Vekt</th><th></th></tr></thead>
          <tbody>{pf.posisjoner.map((p, i) => (<tr key={i}><td><div className="tick"><span className="swdot" style={{ background: SEKTOR_FARGE[p.sektor] }} /><span className="nm">{p.navn}</span></div></td><td className="r mono" data-l="Antall">{p.antall != null ? p.antall.toLocaleString('nb-NO') : '–'}</td><td className="r mono" data-l="Markedsverdi">{formaterKr(p.liveVerdi)}</td><td className="r mono" data-l="Dir.avk.">{p.direkteavkastning != null ? formaterPst(p.direkteavkastning) : '–'}</td><td className="r mono wt" data-l="Vekt">{p.vekt.toFixed(1)}%</td><td className="r">{formaterUtbytteMelding(p) && (<button type="button" className="btn ghost" style={{ padding: '4px 12px', fontSize: 12.5 }} onClick={() => apneDel(p)}>Del</button>)}</td></tr>))}</tbody>
        </table>
      </div>

      {delPos && (
        <div className="mod-overlay" onClick={(e) => { if (e.target.className === 'mod-overlay') lukkDel() }}>
          <div className="mod-dialog">
            {delSuksess ? (
              <>
                <h3>Delt!</h3>
                <p className="mod-tekst">Meldingen er sendt til rommet.</p>
                <button className="btn" style={{ marginTop: 18, width: '100%' }} onClick={lukkDel}>Lukk</button>
              </>
            ) : (
              <>
                <h3>Del utbytte fra {delPos.navn}</h3>
                <p className="mod-tekst">{formaterUtbytteMelding(delPos)}</p>
                {lasterRomDel ? (
                  <div className="muted-note" style={{ marginTop: 14 }}>Laster rom …</div>
                ) : mineRomDel.length === 0 ? (
                  <div className="muted-note" style={{ marginTop: 14 }}>Du er ikke medlem av noen rom ennå.</div>
                ) : (
                  <div className="field" style={{ marginTop: 16 }}>
                    <span>Velg rom</span>
                    <select className="kalk-select" value={delRomId} onChange={(e) => setDelRomId(e.target.value)}>
                      <option value="">— velg rom —</option>
                      {mineRomDel.map((r) => (<option key={r.id} value={r.id}>#{r.navn}</option>))}
                    </select>
                  </div>
                )}
                {delFeil && <div className="import-feil" style={{ marginTop: 14 }}>{delFeil}</div>}
                <div className="mod-knapper">
                  <button className="btn ghost" onClick={lukkDel} disabled={deler}>Avbryt</button>
                  <button className="btn" disabled={!delRomId || deler} onClick={delTilRom}>
                    {deler ? 'Deler …' : 'Del i rommet'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {slettKontoNavn && (
        <div className="mod-overlay" onClick={(e) => { if (e.target.className === 'mod-overlay') setSlettKontoNavn(null) }}>
          <div className="mod-dialog">
            <h3>Slette kontoen «{slettKontoNavn}»?</h3>
            <p className="mod-tekst">
              Alle posisjonene på denne kontoen fjernes fra porteføljen din. Andre kontoer berøres ikke. Du kan
              importere kontoen på nytt senere hvis du ombestemmer deg.
            </p>
            <div className="mod-knapper">
              <button className="btn ghost" onClick={() => setSlettKontoNavn(null)} disabled={sletterKonto}>Avbryt</button>
              <button className="btn fare" disabled={sletterKonto} onClick={() => slettKonto(slettKontoNavn)}>
                {sletterKonto ? 'Sletter …' : 'Slett kontoen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
