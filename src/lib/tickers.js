const REGLER = [
  ['equinor','EQNR.OL'],['aker bp','AKRBP.OL'],['vår energi','VAR.OL'],['var energi','VAR.OL'],['bluenord','BNOR.OL'],['dno','DNO.OL'],
  ['mowi','MOWI.OL'],['salmar','SALM.OL'],['lerøy','LSG.OL'],['leroy','LSG.OL'],['austevoll','AUSS.OL'],['grieg seafood','GSF.OL'],
  ['telenor','TEL.OL'],['telia','TELIA.ST'],['dnb','DNB.OL'],['storebrand','STB.OL'],['gjensidige','GJF.OL'],['protector','PROT.OL'],
  ['yara','YAR.OL'],['norsk hydro','NHY.OL'],['hydro','NHY.OL'],['orkla','ORK.OL'],['kongsberg','KOG.OL'],['tomra','TOM.OL'],
  ['mpc container','MPCC.OL'],['mpcc','MPCC.OL'],['wallenius','WAWI.OL'],['höegh','HAUTO.OL'],['hoegh','HAUTO.OL'],['frontline','FRO.OL'],['golden ocean','GOGL.OL'],['belships','BELCO.OL'],
  ['iberdrola','IBE.MC'],['scatec','SCATC.OL'],['nel','NEL.OL'],['ørsted','ORSTED.CO'],['orsted','ORSTED.CO'],
]
export function finnTicker(navn){ const n=(navn||'').toLowerCase(); for(const [ord,t] of REGLER) if(n.includes(ord)) return t; return null }
