const publicationDayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
// Zmiana ceny względem poprzedniego zamknięcia, nie wynik zakupu.
export function dailyChange(quote){
 if(!quote||!Number.isFinite(quote.price)||quote.price<=0||!Number.isFinite(quote.change_percent)||quote.change_percent<=-100||!quote.currency||!Number.isFinite(Date.parse(quote.as_of)))return null;
 const previous=quote.price/(1+quote.change_percent/100);
 return {...quote,change_amount:quote.price-previous};
}
export function portfolioOverview(instruments,purchases,quotes){
 const ids=new Set(purchases.filter(p=>p.quantity>0).map(p=>p.instrument_id));
 const owned=instruments.filter(i=>ids.has(i.id)).map(i=>({...i,quantity:purchases.filter(p=>p.instrument_id===i.id).reduce((n,p)=>n+p.quantity,0),quote:dailyChange(quotes.find(q=>q.instrument_id===i.id))}));
 const all=instruments.map(i=>({...i,quote:dailyChange(quotes.find(q=>q.instrument_id===i.id))}));
 // Ranking całej listy: wyłącznie notowania z tego samego dnia.
 const latest=all.filter(i=>i.quote).map(i=>i.quote.as_of.slice(0,10)).sort().at(-1)||null;
 const movers=all.filter(i=>i.quote&&i.quote.as_of.slice(0,10)===latest).sort((a,b)=>Math.abs(b.quote.change_percent)-Math.abs(a.quote.change_percent)||a.name.localeCompare(b.name)).slice(0,3);
 return {owned,movers,asOf:latest};
}
export function marketLeaders(instruments,quotes){
 const all=instruments.map(i=>({...i,quote:dailyChange(quotes.find(q=>q.instrument_id===i.id))}));
 return ['stock','etf'].map(type=>{
  const valid=all.filter(i=>i.type===type&&i.quote);
  const asOf=valid.map(i=>i.quote.as_of.slice(0,10)).sort().at(-1)||null;
  const current=valid.filter(i=>i.quote.as_of.slice(0,10)===asOf);
  const order=(a,b)=>b.quote.change_percent-a.quote.change_percent||a.name.localeCompare(b.name);
  return {type,asOf,count:current.length,total:instruments.filter(i=>i.type===type).length,gains:current.filter(i=>i.quote.change_percent>0).sort(order).slice(0,3),losses:current.filter(i=>i.quote.change_percent<0).sort((a,b)=>order(b,a)).slice(0,3)};
 });
}

export function publicationDay(value){
 if(!value||!Number.isFinite(Date.parse(value)))return null;
 return publicationDayFormatter.format(new Date(value));
}
export function selectPublications(articles,{view='today',from='',to='',category='wszystkie',query='',now=new Date().toISOString()}={}){
 const today=publicationDay(now);
 const shifted=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
 const yesterday=shifted(1),before=shifted(2),weekStart=shifted(6);
 return articles.filter(a=>{
  if(a.deleted_at)return false;
  const day=publicationDay(a.published_at);
  if(view==='today'?day!==today:view==='yesterday'?day!==yesterday:view==='before_yesterday'?day!==before:view==='week'?(!day||day<weekStart||day>today):day&&day>=before)return false;
  if(['week','archive'].includes(view)&&((from&&(!day||day<from))||(to&&(!day||day>to))))return false;
  if(category==='komunikaty'&&a.publication_kind!=='press')return false;
  if(category==='nieprzeczytane'?!!a.read_at:category==='ważne'?!a.starred:category!=='wszystkie'&&category!=='komunikaty'&&a.category!==category)return false;
  return `${a.title_pl||a.title} ${a.instrument_name} ${a.summary||''}`.toLowerCase().includes(query.toLowerCase());
 }).sort((a,b)=>Number(!!b.starred)-Number(!!a.starred)||(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0));
}
export function sortAssets(items,quotes,key='name',direction='asc'){
 const quoteMap=new Map(quotes.map(q=>[q.instrument_id,q]));
 const value=i=>{const q=quoteMap.get(i.id);const v=q?.[key==='price'?'price':'change_percent'];return typeof v==='number'&&Number.isFinite(v)&&(key!=='price'||v>0)?v:null;};
 return [...items].sort((a,b)=>{
  if(key==='name')return (direction==='desc'?-1:1)*a.name.localeCompare(b.name,'pl');
  const av=value(a),bv=value(b);if(av===null||bv===null)return av===bv?a.name.localeCompare(b.name,'pl'):av===null?1:-1;
  return (direction==='desc'?-1:1)*(av-bv)||a.name.localeCompare(b.name,'pl');
 });
}
export function purchaseImport(payload,instruments){
 if(!payload||!Array.isArray(payload.transactions)||!payload.transactions.length||payload.transactions.length>100)throw Error('Niepoprawny plik zakupów');
 return payload.transactions.map(t=>{
  const record={instrument_id:t.instrument_id||payload.instrument_id,quantity:t.quantity,price:t.price??t.unit_price,currency:t.currency||payload.currency,purchased_on:t.purchased_on};
  if(!instruments.some(i=>i.id===record.instrument_id)||!Number.isFinite(record.quantity)||record.quantity<=0||record.quantity>1e12||!Number.isFinite(record.price)||record.price<0||record.price>1e12||!['USD','EUR','PLN','GBP','CHF'].includes(record.currency)||!/^\d{4}-\d{2}-\d{2}$/.test(record.purchased_on)||!Number.isFinite(Date.parse(record.purchased_on))||new Date(record.purchased_on).toISOString().slice(0,10)!==record.purchased_on)throw Error('Niepoprawne dane zakupu');
  if(t.total_paid!==undefined&&(!Number.isFinite(t.total_paid)||Math.abs(record.price*record.quantity-t.total_paid)>.005))throw Error('Cena nie obejmuje pełnego kosztu zakupu');
  return record;
 });
}
export function samePurchase(a,b){return ['instrument_id','quantity','price','currency','purchased_on'].every(key=>a[key]===b[key]);}

// A profile response is newer than the dashboard snapshot. Keep both views in sync.
export function mergeInstrumentArticles(current,instrumentId,incoming){
 const pending=new Map(incoming.filter(a=>a.instrument_id===instrumentId).map(a=>[a.id,a]));
 const result=[];
 for(const article of current){
  if(article.instrument_id!==instrumentId){result.push(article);continue;}
  if(pending.has(article.id)){
   const fresh=pending.get(article.id);
   // A slower request must not erase an already completed summary of this revision.
   result.push(article.content_hash&&article.content_hash===fresh.content_hash&&article.summary&&!fresh.summary?article:fresh);
   pending.delete(article.id);
  }
 }
 return [...result,...pending.values()];
}
export const summaryNeedsRefresh=article=>!!article&&!article.summary&&['queued','running'].includes(article.job_status);
export const summaryVersion=article=>JSON.stringify([article?.summary||'',article?.job_status||'',article?.summary_basis||'',article?.ai_at||'']);
