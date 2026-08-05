import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  oppdagRom, opprettRom, bliMedlem, forlatRom,
  hentRomMeldinger, hentRomMedlemmer, sendRomMelding, abonnerPaaRom, slettRomMelding, slettRom,
} from '../lib/rooms'
import RomChat from '../components/RomChat'
import Forum from '../components/Forum'
import { useVarsler, markerLest } from '../context/VarselContext'

export default function Rom() {
  const { user } = useAuth()
  const varsler = useVarsler()
  const [alleRom, setAlleRom] = useState([])
  const [laster, setLaster] = useState(true)
  const [visning, setVisning] = useState('oppdag') // 'oppdag' | 'opprett' | 'chat'
  const [aktivtRom, setAktivtRom] = useState(null)
  const [romModus, setRomModus] = useState('chat')
  const [meldinger, setMeldinger] = useState([])
  const [romMedlemmer, setRomMedlemmer] = useState([])
  const navnCache = useRef({})
  const ryddRef = useRef(null)

  const [nyNavn, setNyNavn] = useState('')
  const [nyBesk, setNyBesk] = useState('')
  const [oFeil, setOFeil] = useState('')
  const [jobber, setJobber] = useState(false)
  const [erAdmin, setErAdmin] = useState(false)
  const [visSlettRom, setVisSlettRom] = useState(false)
  const [slettNavn, setSlettNavn] = useState('')

  const mineRom = alleRom.filter((r) => r.er_medlem)

  async function last() {
    try { setAlleRom(await oppdagRom()) } finally { setLaster(false) }
  }
  useEffect(() => { last(); supabase.rpc('er_admin').then(({ data }) => setErAdmin(!!data)).catch(() => {}) }, [])
  useEffect(() => () => { if (ryddRef.current) ryddRef.current() }, [])

  async function aapneRom(rom) {
    if (ryddRef.current) { ryddRef.current(); ryddRef.current = null }
    setAktivtRom(rom); setVisning('chat'); setRomModus('chat'); setMeldinger([])
    const medlemmer = await hentRomMedlemmer(rom.id)
    const cache = {}
    medlemmer.forEach((m) => { cache[m.bruker_id] = { brukernavn: m.brukernavn, avatar_farge: m.avatar_farge } })
    navnCache.current = cache
    setRomMedlemmer(medlemmer)
    setMeldinger(await hentRomMeldinger(rom.id))
    await markerLest('rom', rom.id)
    varsler.refresh()
    ryddRef.current = abonnerPaaRom(rom.id, (ny) => {
      setMeldinger((liste) => {
        if (liste.some((x) => x.id === ny.id)) return liste
        const p = navnCache.current[ny.avsender_id] || { brukernavn: 'Ukjent', avatar_farge: '#8893A0' }
        return [...liste, { ...ny, brukernavn: p.brukernavn, avatar_farge: p.avatar_farge }]
      })
    })
  }

  async function send(tekst) {
    const ny = await sendRomMelding(user.id, aktivtRom.id, tekst)
    const p = navnCache.current[user.id] || { brukernavn: 'Deg', avatar_farge: '#12868C' }
    setMeldinger((m) => [...m, { ...ny, brukernavn: p.brukernavn, avatar_farge: p.avatar_farge }])
  }

  async function slett(id) {
    await slettRomMelding(id)
    setMeldinger((m) => m.filter((x) => x.id !== id))
  }

  async function bliMed(rom) {
    setJobber(true)
    try { await bliMedlem(user.id, rom.id); await last(); await aapneRom({ ...rom, er_medlem: true }) }
    finally { setJobber(false) }
  }

  async function slettRommet() {
    if (!aktivtRom) return
    setJobber(true)
    try {
      await slettRom(aktivtRom.id)
      if (ryddRef.current) { ryddRef.current(); ryddRef.current = null }
      setAktivtRom(null); setVisSlettRom(false); setSlettNavn(''); setVisning('oppdag')
      await last()
    } catch (e) {
      setOFeil(e.message)
    } finally {
      setJobber(false)
    }
  }

  async function forlat() {
    if (!aktivtRom) return
    setJobber(true)
    try {
      await forlatRom(user.id, aktivtRom.id)
      if (ryddRef.current) { ryddRef.current(); ryddRef.current = null }
      setAktivtRom(null); setVisning('oppdag'); await last()
    } finally { setJobber(false) }
  }

  async function opprett(e) {
    e.preventDefault(); setOFeil('')
    if (nyNavn.trim().length < 2) { setOFeil('Gi rommet et navn (minst 2 tegn).'); return }
    setJobber(true)
    try {
      const rom = await opprettRom(user.id, nyNavn, nyBesk)
      setNyNavn(''); setNyBesk('')
      await last()
      await aapneRom({ ...rom, er_medlem: true, antall_medlemmer: 1 })
    } catch (err) { setOFeil(err.message) }
    finally { setJobber(false) }
  }

  if (laster) return <div className="page"><div className="page-head"><h1>Rom</h1></div><div className="muted-note">Laster …</div></div>

  return (
    <div className="page meldinger-page">
      <div className="page-head"><h1>Rom</h1><p className="page-sub">Fellesskap og gruppechat</p></div>

      <div className="dm-layout">
        <div className="dm-sidebar">
          <button className={'dm-venner-btn' + (visning === 'oppdag' ? ' aktiv' : '')} onClick={() => { setVisning('oppdag'); setAktivtRom(null) }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            Oppdag rom
          </button>
          <button className={'dm-venner-btn' + (visning === 'opprett' ? ' aktiv' : '')} onClick={() => { setVisning('opprett'); setAktivtRom(null) }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>
            Opprett rom
          </button>
          <div className="dm-liste-tittel">Dine rom</div>
          {mineRom.length === 0 ? (
            <div className="dm-liste-tom">Du er ikke med i noen rom</div>
          ) : (
            mineRom.map((r) => (
              <button key={r.id} className={'dm-venn' + (aktivtRom?.id === r.id ? ' aktiv' : '')} onClick={() => aapneRom(r)}>
                <div className="rom-ikon">#</div>
                <span className="dm-venn-navn">{r.navn}</span>
                {varsler.perRomNevnelser?.[r.id] > 0 && (
                  <span className="nevnelse-tall" title="Du er nevnt her">@{varsler.perRomNevnelser[r.id]}</span>
                )}
                {varsler.perRom?.[r.id] > 0 && (
                  <span className="ulest-tall">{varsler.perRom[r.id]}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="dm-hoved">
          {visning === 'chat' && aktivtRom ? (
            <div className="rom-vindu">
              <div className="rom-head">
                <div className="rom-head-info">
                  <div className="rom-head-navn"># {aktivtRom.navn}</div>
                  {aktivtRom.beskrivelse && <div className="rom-head-besk">{aktivtRom.beskrivelse}</div>}
                </div>
                <div className="rom-modus">
                  <button className={'rom-modus-knapp' + (romModus === 'chat' ? ' on' : '')} onClick={() => setRomModus('chat')}>Chat</button>
                  <button className={'rom-modus-knapp' + (romModus === 'forum' ? ' on' : '')} onClick={() => setRomModus('forum')}>Forum</button>
                </div>
                {aktivtRom.eier_id === user.id ? (
                  <button className="btn ghost liten fare-tekst" onClick={() => setVisSlettRom(true)} disabled={jobber}>
                    Slett rom
                  </button>
                ) : (
                  <button className="btn ghost liten" onClick={forlat} disabled={jobber}>Forlat rom</button>
                )}
              </div>
              {romModus === 'chat'
                ? <RomChat rom={aktivtRom} meldinger={meldinger} megId={user.id}
                    megNavn={navnCache.current[user.id]?.brukernavn} medlemmer={romMedlemmer}
                    onSend={send} onSlett={slett}
                    erEier={aktivtRom.eier_id === user.id || erAdmin}
                    onBlokkert={async () => { setMeldinger(await hentRomMeldinger(aktivtRom.id)) }} />
                : <Forum rom={aktivtRom} megId={user.id} />}
            </div>
          ) : visning === 'opprett' ? (
            <div className="venner-panel">
              <form onSubmit={opprett} className="legg-form" style={{ maxWidth: 480 }}>
                <div className="field"><span>Romnavn</span>
                  <input value={nyNavn} onChange={(e) => setNyNavn(e.target.value)} placeholder="f.eks. Utbytte Norge" />
                </div>
                <div className="field" style={{ marginTop: 14 }}>
                  <span>Beskrivelse <small style={{ color: 'var(--faint)', fontWeight: 400 }}>(valgfritt)</small></span>
                  <textarea value={nyBesk} onChange={(e) => setNyBesk(e.target.value)} rows={3} maxLength={200} placeholder="Hva handler rommet om?" />
                </div>
                {oFeil && <div className="import-feil" style={{ marginTop: 14 }}>{oFeil}</div>}
                <button className="btn" style={{ marginTop: 16 }} disabled={jobber}>{jobber ? 'Oppretter …' : 'Opprett rom'}</button>
                <div className="comp-note" style={{ marginTop: 16 }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>
                  Rom er for diskusjon og analyse. Betalt tilgang til sanntids kjøps-/salgssignaler er ikke tillatt.
                </div>
              </form>
            </div>
          ) : (
            <div className="venner-panel">
              <div className="rom-oppdag-tittel">Oppdag rom</div>
              {alleRom.length === 0 ? (
                <div className="muted-note">Ingen rom ennå. Opprett det første under «Opprett rom».</div>
              ) : (
                <div className="rom-grid">
                  {alleRom.map((r) => (
                    <div key={r.id} className="rom-kort">
                      <div className="rom-kort-topp">
                        <div className="rom-kort-ikon">#</div>
                        <div><div className="rom-kort-navn">{r.navn}</div><div className="rom-kort-medl">{Number(r.antall_medlemmer)} medlemmer</div></div>
                      </div>
                      {r.beskrivelse && <div className="rom-kort-besk">{r.beskrivelse}</div>}
                      {r.er_medlem
                        ? <button className="btn ghost liten" onClick={() => aapneRom(r)}>Åpne</button>
                        : <button className="btn liten" onClick={() => bliMed(r)} disabled={jobber}>Bli med</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {visSlettRom && aktivtRom && (
        <div className="mod-overlay" onClick={(e) => { if (e.target.className === 'mod-overlay') setVisSlettRom(false) }}>
          <div className="mod-dialog">
            <h3>Slette rommet «{aktivtRom.navn}»?</h3>
            <p className="mod-tekst">
              Alle meldinger, forumtråder og svar i rommet slettes permanent — også for
              de {Number(aktivtRom.antall_medlemmer) || 1} medlemmene. Dette kan <b>ikke</b> angres.
            </p>
            <div className="field" style={{ marginTop: 18 }}>
              <span>Skriv romnavnet <b>{aktivtRom.navn}</b> for å bekrefte</span>
              <input value={slettNavn} onChange={(e) => setSlettNavn(e.target.value)} placeholder={aktivtRom.navn} />
            </div>
            <div className="mod-knapper">
              <button className="btn ghost" onClick={() => { setVisSlettRom(false); setSlettNavn('') }} disabled={jobber}>
                Avbryt
              </button>
              <button className="btn fare" disabled={slettNavn !== aktivtRom.navn || jobber} onClick={slettRommet}>
                {jobber ? 'Sletter …' : 'Slett rommet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
