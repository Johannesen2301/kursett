import { finnSektor, SEKTOR_FARGE, SEKTOR_NAVN } from './sectors'
import { finnTicker } from './tickers'
const MND=['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
function medLivePriser(posisjoner,prisdata){
  const priser=prisdata?.priser||{}; const fx=prisdata?.fx||{NOK:1}
  return posisjoner.map(p=>{ const ticker=p.ticker||finnTicker(p.navn); const pd=ticker?priser[ticker]:null
    if(pd&&pd.pris&&!pd.feil&&p.antall!=null){ const kurs=fx[pd.valuta]||1; const liveVerdi=pd.pris*p.antall*kurs
      return { ...p, harLive:true, livePris:pd.pris, liveValuta:pd.valuta, fxKurs:kurs, liveVerdi, direkteavkastning:pd.direkteavkastning, aarligUtbytteNOK:(pd.aarligUtbytte||0)*p.antall*kurs, utbytter:pd.utbytter||[] } }
    return { ...p, harLive:false, liveVerdi:p.markedsverdi, utbytter:[] } })
}
function utbyttekalender(posisjoner){ const mnd=Array(12).fill(0); const naa=Date.now()/1000
  for(const p of posisjoner){ if(!p.utbytter||!p.antall)continue; for(const u of p.utbytter){ if(u.dato<naa-365*24*3600)continue; const d=new Date(u.dato*1000); mnd[d.getMonth()]+=(u.belop||0)*p.antall*(p.fxKurs||1) } }
  const maks=Math.max(...mnd,1); return mnd.map((belop,i)=>({ mnd:MND[i], belop, andel:(belop/maks)*100 })) }
export function beregnPortefolje(posisjonerRaa,prisdata){
  const posisjoner=medLivePriser(posisjonerRaa,prisdata); const harLive=posisjoner.some(p=>p.harLive)
  const total=posisjoner.reduce((s,p)=>s+(p.liveVerdi||0),0)
  const medVekt=posisjoner.map(p=>({ ...p, sektor:p.sektor||finnSektor(p.navn), vekt:total>0?(p.liveVerdi/total)*100:0 })).sort((a,b)=>b.liveVerdi-a.liveVerdi)
  const sektorMap={}; for(const p of medVekt) sektorMap[p.sektor]=(sektorMap[p.sektor]||0)+p.vekt
  const sektorer=Object.keys(sektorMap).map(s=>({ sektor:s, navn:SEKTOR_NAVN[s], farge:SEKTOR_FARGE[s], vekt:sektorMap[s] })).sort((a,b)=>b.vekt-a.vekt)
  let kostpris=0, harGav=false; for(const p of medVekt){ if(p.gav!=null&&p.antall!=null){ kostpris+=p.gav*p.antall; harGav=true } }
  const gevinst=harGav?total-kostpris:null; const gevinstPst=harGav&&kostpris>0?(gevinst/kostpris)*100:null
  const aarligUtbytte=medVekt.reduce((s,p)=>s+(p.aarligUtbytteNOK||0),0)
  const direkteavkastning=total>0&&harLive?(aarligUtbytte/total)*100:null
  const kalender=harLive?utbyttekalender(medVekt):null
  return { total, antall:medVekt.length, posisjoner:medVekt, sektorer, gevinst, gevinstPst, harLive, aarligUtbytte, direkteavkastning, kalender }
}
export function formaterKr(n){ if(n==null)return '–'; return Math.round(n).toLocaleString('nb-NO')+' kr' }
export function formaterPst(n,tegn=false){ if(n==null)return '–'; const s=n.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1}); return (tegn&&n>0?'+':'')+s+' %' }
// Bygger en delbar tekstmelding for siste utbytte fra én posisjon. Deler kun beløp per
// aksje og direkteavkastning (offentlig markedsdata) — aldri antall aksjer eller totalt
// mottatt beløp, som ville avslørt posisjonsstørrelsen (jf. personvern-notatet i Portefølje).
export function formaterUtbytteMelding(p){
  if(!p?.utbytter?.length) return null
  const siste=[...p.utbytter].sort((a,b)=>b.dato-a.dato)[0]
  if(!siste?.belop) return null
  const dato=new Date(siste.dato*1000).toLocaleDateString('nb-NO',{day:'numeric',month:'long'})
  const valuta=!p.liveValuta||p.liveValuta==='NOK'?'kr':p.liveValuta
  const belop=siste.belop.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})
  const avk=p.direkteavkastning!=null?` — direkteavkastning ${formaterPst(p.direkteavkastning)}`:''
  return `📈 ${p.navn} betalte ${belop} ${valuta}/aksje i utbytte ${dato}${avk}`
}
