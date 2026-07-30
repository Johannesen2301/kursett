import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseNordnetCSV } from '../lib/nordnet'
import { finnSektor, SEKTOR_FARGE } from '../lib/sectors'
import { beregnPortefolje, formaterKr, formaterPst } from '../lib/portfolio'
import { hentPriser } from '../lib/prices'
import Band from '../components/Band'

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
    setFeil(''); setImportStatus(''); setImporterer(true)
    try {
      const buf = await file.arrayBuffer()
      const { positions } = parseNordnetCSV(buf)
      const rader = positions.map((p) => ({ bruker_id: user.id, navn: p.navn, isin: p.isin, ticker: null, sektor: finnSektor(p.navn), antall: p.antall, markedsverdi: p.markedsverdi, gav: p.gav, konto: file.name }))
      const { data: slettet, error: delErr } = await supabase.from('posisjoner').delete().eq('bruker_id', user.id).select('id')
      if (delErr) throw new Error(delErr.message)
      const { error: insErr } = await supabase.from('posisjoner').insert(rader)
      if (insErr) throw new Error(insErr.message)
      const d = await lastPosisjoner(); oppdaterPriser(d)
      setImportStatus(
        `Fila hadde ${positions.length} rad(er). Slettet ${slettet?.length ?? 0} gamle posisjon(er), ` +
        `la til ${rader.length} nye. Du har nå ${d.length} posisjon(er) totalt.`
      )
    } catch (err) { setFeil(err.message) }
    finally { setImporterer(false); if (fileRef.current) fileRef.current.value = '' }
  }

  if (lasterData) return (<div className="page"><div className="page-head"><h1>Min portefølje</h1></div><div className="muted-note">Laster …</div></div>)

  if (posisjoner.length === 0) return (
    <div className="page">
      <div className="page-head"><h1>Min portefølje</h1><p className="page-sub">Innlogget som {user?.email}</p></div>
      <div className="import-card">
        <div className="import-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg></div>
        <h2>Importer porteføljen din</h2>
        <p>Last opp «aksjelister»-CSV-en fra Nordnet, så viser vi sammensetningen din som et sektorfarget bånd — ditt eget fingeravtrykk.</p>
        {feil && <div className="import-feil">{feil}</div>}
        <button className="btn" disabled={importerer} onClick={() => fileRef.current?.click()}>{importerer ? 'Importerer …' : 'Velg CSV-fil'}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
        <div className="import-hint">Nordnet → Depot → Beholdning → last ned som CSV.</div>
      </div>
    </div>)

  const pf = beregnPortefolje(posisjoner, prisdata)
  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div><h1>Min portefølje</h1><p className="page-sub">{pf.antall} posisjoner · {pf.harLive ? 'live kurser ' + (sistOppdatert ? sistOppdatert.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '') : 'verdier fra import'}</p></div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn ghost" disabled={oppdaterer} onClick={() => oppdaterPriser(posisjoner)}>{oppdaterer ? 'Oppdaterer …' : 'Oppdater kurser'}</button>
          <button className="btn ghost" disabled={importerer} onClick={() => fileRef.current?.click()}>{importerer ? 'Importerer …' : 'Importer på nytt'}</button>
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
          <thead><tr><th>Aksje</th><th className="r">Antall</th><th className="r">Markedsverdi</th><th className="r">Dir.avk.</th><th className="r">Vekt</th></tr></thead>
          <tbody>{pf.posisjoner.map((p, i) => (<tr key={i}><td><div className="tick"><span className="swdot" style={{ background: SEKTOR_FARGE[p.sektor] }} /><span className="nm">{p.navn}</span></div></td><td className="r mono" data-l="Antall">{p.antall != null ? p.antall.toLocaleString('nb-NO') : '–'}</td><td className="r mono" data-l="Markedsverdi">{formaterKr(p.liveVerdi)}</td><td className="r mono" data-l="Dir.avk.">{p.direkteavkastning != null ? formaterPst(p.direkteavkastning) : '–'}</td><td className="r mono wt" data-l="Vekt">{p.vekt.toFixed(1)}%</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}
