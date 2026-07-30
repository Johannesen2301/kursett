import { useEffect, useState } from 'react'
export default function Band({ sektorer, height=52 }){
  const [vis,setVis]=useState(false)
  useEffect(()=>{ const t=setTimeout(()=>setVis(true),80); return ()=>clearTimeout(t) },[])
  return (<div className="band" style={{ height }}>
    {sektorer.map(s=>(<div key={s.sektor} className="band-seg" style={{ width:(vis?s.vekt:0)+'%', background:s.farge }} title={`${s.navn} ${s.vekt.toFixed(1)} %`} />))}
  </div>)
}
