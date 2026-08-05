export const SEKTOR_FARGE = { energi:'#4E7A8A', sjomat:'#6FA08C', telekom:'#8E7CA8', finans:'#C2A05A', industri:'#A8836A', shipping:'#9C6B52', fornybar:'#7E9A5C', teknologi:'#5477A6', helse:'#BD6B6B', forbruk:'#B87A93', eiendom:'#8A9A6E', annet:'#B8B3A6' }
export const SEKTOR_NAVN = { energi:'Energi', sjomat:'Sjømat', telekom:'Telekom', finans:'Finans', industri:'Industri', shipping:'Shipping', fornybar:'Fornybar', teknologi:'Teknologi', helse:'Helse', forbruk:'Forbruk', eiendom:'Eiendom', annet:'Annet' }
const REGLER = [
  ['energi',['equinor','aker bp','vår energi','var energi','bluenord','dno','okea','panoro','subsea','aker solutions','seadrill','borr']],
  ['sjomat',['mowi','salmar','lerøy','leroy','austevoll','grieg seafood','bakkafrost','norway royal','nrs']],
  ['telekom',['telenor','telia','ice group']],
  ['finans',['dnb','storebrand','gjensidige','sparebank','sbanken','protector','aker asa','pareto']],
  ['industri',['yara','norsk hydro','hydro','orkla','kongsberg','tomra','nordic semiconductor','autostore','elkem','borregaard','veidekke']],
  ['shipping',['mpc container','mpcc','wallenius','höegh','hoegh','frontline','golden ocean','belships','stolt','flex lng','okeanis']],
  ['fornybar',['iberdrola','scatec','nel','cadeler','orsted','ørsted','aker horizons']],
]
export function finnSektor(navn){ const n=(navn||'').toLowerCase(); for(const [s,ord] of REGLER){ if(ord.some(o=>n.includes(o))) return s } return 'annet' }
