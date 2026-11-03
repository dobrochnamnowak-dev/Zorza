import {readFileSync} from 'node:fs';
import {boundedFetch} from './collector.mjs';
const mappings=JSON.parse(readFileSync(new URL('../quote-sources.json',import.meta.url),'utf8'));
export function validateQuoteIdentity(payload,mapping){
 const meta=payload?.chart?.result?.[0]?.meta;
 if(payload?.chart?.error||!meta||meta.symbol!==mapping.symbol||meta.currency!==mapping.currency||meta.instrumentType!==(mapping.instrumentType||'EQUITY')||(mapping.exchange&&meta.exchangeName!==mapping.exchange)||(mapping.verified_name&&meta.longName!==mapping.verified_name))throw Error('Nie potwierdzono symbolu, waluty, nazwy lub rodzaju instrumentu');
 return meta;
}
export function parseQuote(payload,mapping,now=Date.now()){
 const meta=validateQuoteIdentity(payload,mapping);
 const price=meta.regularMarketPrice,previous=meta.chartPreviousClose,time=meta.regularMarketTime;
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(previous)||previous<=0||!Number.isFinite(time)||time<=0||time*1000>now+300000)throw Error('Brak poprawnej ceny, poprzedniego zamknięcia lub daty');
 if(now-time*1000>7*86400000)throw Error('Notowanie starsze niż 7 dni');
 return {instrument_id:mapping.instrument_id,price,change_percent:(price/previous-1)*100,currency:meta.currency,as_of:new Date(time*1000).toISOString(),source:`Yahoo Finance · ${mapping.symbol} · sesja regularna · możliwe opóźnienie`};
}
export async function fetchQuotes({fetcher=fetch,onProgress=()=>{},sources=mappings}={}){
 const report={checked_at:new Date().toISOString(),quotes:[],errors:[]};
 const deadline=Date.now()+8*60000;
 let index=0,stopped=false;
 // Niewielka liczba połączeń; przy blokadzie nie ponawiamy ani nie zmieniamy źródła.
 await Promise.all(Array.from({length:2},async()=>{while(index<sources.length&&!stopped){if(Date.now()>deadline){stopped=true;break;}const mapping=sources[index++];try{
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(mapping.symbol)+'?interval=1d&range=1d';
  const {response,text}=await boundedFetch(url,{'Accept':'application/json'},fetcher);
  report.quotes.push(parseQuote(JSON.parse(text),mapping));
 }catch(error){report.errors.push({...mapping,error:error.message});if(/HTTP (401|403|429)/.test(error.message))stopped=true;}
 onProgress(report.quotes.length+report.errors.length,sources.length);
 await new Promise(resolve=>setTimeout(resolve,200));
 }}));
 report.stopped=stopped;report.configured=sources.length;report.unchecked=sources.length-report.quotes.length-report.errors.length;return report;
}
export async function collectQuotes(store,options={}){
 if(!store.lock('quotes',10*60e3))return {busy:true};
 try{
 const known=new Set(store.db.prepare('SELECT id FROM instruments').all().map(i=>i.id));
 const requested=options.instrumentIds?new Set(options.instrumentIds):known;
 const sources=mappings.filter(m=>known.has(m.instrument_id)&&requested.has(m.instrument_id));
 const report=await fetchQuotes({...options,sources});
 const configured=new Set(sources.map(m=>m.instrument_id));
 report.unmapped=[...requested].filter(id=>!configured.has(id));
 const save=store.db.prepare('INSERT INTO quotes(instrument_id,price,change_percent,currency,as_of,source) VALUES(?,?,?,?,?,?) ON CONFLICT(instrument_id) DO UPDATE SET price=excluded.price,change_percent=excluded.change_percent,currency=excluded.currency,as_of=excluded.as_of,source=excluded.source WHERE excluded.as_of>=quotes.as_of');
 for(const q of report.quotes)if(known.has(q.instrument_id))save.run(q.instrument_id,q.price,q.change_percent,q.currency,q.as_of,q.source);
 store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run(options.reportKey==='quotes_focus_report'?'quotes_focus_report':'quotes_report',JSON.stringify({checked_at:report.checked_at,downloaded:report.quotes.length,configured:report.configured,errors:report.errors,stopped:report.stopped,unchecked:report.unchecked,unmapped:report.unmapped}));
 return report;
 }finally{store.unlock('quotes');}
}
