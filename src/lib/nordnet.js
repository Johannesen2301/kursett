export function decode(buf){ const b=new Uint8Array(buf); if(b[0]===0xff&&b[1]===0xfe)return new TextDecoder('utf-16le').decode(buf); if(b[0]===0xfe&&b[1]===0xff)return new TextDecoder('utf-16be').decode(buf); const u=new TextDecoder('utf-8').decode(buf); if(u.indexOf('\u0000')>=0)return new TextDecoder('utf-16le').decode(buf); return u }
export function detectDelimiter(line){ const c={'\t':(line.match(/\t/g)||[]).length,';':(line.match(/;/g)||[]).length,',':(line.match(/,/g)||[]).length}; return Object.keys(c).sort((a,b)=>c[b]-c[a])[0] }
export function num(s){ if(s==null)return null; s=String(s).trim().replace(/[\u00a0\s]/g,''); if(s===''||s==='-')return null; if(s.includes(',')&&s.includes('.')){s=s.replace(/\./g,'').replace(',','.')}else{s=s.replace(',','.')} const n=parseFloat(s.replace(/[^0-9.\-]/g,'')); return isNaN(n)?null:n }
export function parseNordnetCSV(buf){
  const text=decode(buf).replace(/^\uFEFF/,'')
  const lines=text.split(/\r?\n/).filter(l=>l.trim()!=='')
  if(lines.length<2) throw new Error('Fant ingen rader i fila. Er dette riktig CSV fra Nordnet?')
  const delim=detectDelimiter(lines[0])
  const rows=lines.map(l=>l.split(delim).map(c=>c.trim().replace(/^"|"$/g,'')))
  const header=rows[0].map(h=>h.trim().toLowerCase())
  const findCol=(cands)=>{ for(const c of cands){const i=header.findIndex(h=>h===c);if(i>=0)return i} for(const c of cands){const i=header.findIndex(h=>h.includes(c));if(i>=0)return i} return -1 }
  const iName=findCol(['verdipapir','navn','instrument','papir','security','name'])
  const iVal=findCol(['markedsverdi','marknadsverdi','market value','marketvalue'])
  const iQty=findCol(['antall','beholdning','kvantitet','quantity'])
  const iPrice=findCol(['sluttkurs','kurs','siste','pris','price'])
  const iIsin=findCol(['isin'])
  const iGav=findCol(['gav','snittkurs','anskaffelse','kostpris','gjennomsnitt'])
  if(iName<0) throw new Error('Fant ikke en kolonne med verdipapirnavn. Kolonnene i fila var: '+header.join(', '))
  if(iVal<0&&(iQty<0||iPrice<0)) throw new Error('Fant verken markedsverdi eller antall+kurs. Kolonnene i fila var: '+header.join(', '))
  const rader=[]
  for(let r=1;r<rows.length;r++){ const row=rows[r]; const navn=(row[iName]||'').trim(); if(!navn)continue
    const antall=iQty>=0?num(row[iQty]):null; const kurs=iPrice>=0?num(row[iPrice]):null
    let markedsverdi=iVal>=0?num(row[iVal]):null; if(markedsverdi==null&&antall!=null&&kurs!=null)markedsverdi=antall*kurs
    if(markedsverdi==null||markedsverdi<=0)continue
    rader.push({ navn, isin:iIsin>=0?(row[iIsin]||'').trim()||null:null, antall, kurs, markedsverdi, gav:iGav>=0?num(row[iGav]):null })
  }
  if(rader.length===0) throw new Error('Fant ingen posisjoner med verdi i fila.')

  // Nordnet lister ofte samme aksje på flere rader (én per anskaffelseslot). Slår
  // sammen rader med samme isin (eller navn hvis isin mangler) til én posisjon,
  // med vektet snitt-GAV, slik at porteføljen viser ett tall per aksje.
  const grupper=new Map()
  for(const p of rader){ const noekkel=p.isin||p.navn.toLowerCase()
    if(!grupper.has(noekkel)) grupper.set(noekkel,[])
    grupper.get(noekkel).push(p)
  }
  const positions=[...grupper.values()].map((lotter)=>{
    const antall=lotter.reduce((s,p)=>s+(p.antall||0),0)
    const markedsverdi=lotter.reduce((s,p)=>s+(p.markedsverdi||0),0)
    const gavSum=lotter.reduce((s,p)=>s+(p.gav!=null&&p.antall!=null?p.gav*p.antall:0),0)
    const gavAntall=lotter.reduce((s,p)=>s+(p.gav!=null&&p.antall!=null?p.antall:0),0)
    return {
      navn:lotter[0].navn, isin:lotter[0].isin,
      antall:antall||null, markedsverdi,
      gav:gavAntall>0?gavSum/gavAntall:null,
    }
  })
  return { positions }
}
