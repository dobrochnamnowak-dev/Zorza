import {readFileSync} from 'node:fs';
import {boundedFetch} from './collector.mjs';
import {validateQuoteIdentity} from './quotes.mjs';

const defaultMappings=JSON.parse(readFileSync(new URL('../quote-sources.json',import.meta.url),'utf8'));
export const historyRanges=Object.freeze({
 '1d':{range:'1d',interval:'5m',ttl:15*60000},
 '1w':{range:'5d',interval:'30m',ttl:30*60000},
 '1y':{range:'1y',interval:'1d',ttl:6*3600000},
 '5y':{range:'5y',interval:'1wk',ttl:24*3600000}
});
const error=(message,status=503)=>Object.assign(Error(message),{status});
export function parseHistory(payload,mapping,period,now=Date.now()){
 if(!Object.hasOwn(historyRanges,period))throw error('Nieprawidłowy zakres wykresu',400);
 const meta=validateQuoteIdentity(payload,mapping),result=payload.chart.result[0];
 const timestamps=result.timestamp,values=result.indicators?.quote?.[0]?.close;
 if(!Array.isArray(timestamps)||!Array.isArray(values)||timestamps.length>1500)throw error('Brak historii notowań');
 const byTime=new Map();
 for(let index=0;index<timestamps.length;index++){
  const time=timestamps[index],value=values[index];
  if(!Number.isFinite(time)||time<=0||time*1000>now+300000)continue;
  byTime.set(time,{time:new Date(time*1000).toISOString(),value:Number.isFinite(value)&&value>0?value:null});
 }
 const points=[...byTime.entries()].sort((a,b)=>a[0]-b[0]).map(([,p])=>p),valid=points.filter(p=>p.value!==null);
 if(valid.length<2)throw error('Za mało danych do wykresu',404);
 // The series is the provider's closing-price series, not a dividend-reinvested return.
 const first=valid[0],last=valid.at(-1),baseline=period==='1d'&&Number.isFinite(meta.chartPreviousClose)&&meta.chartPreviousClose>0?meta.chartPreviousClose:first.value;
 return {instrument_id:mapping.instrument_id,period,currency:mapping.currency,symbol:mapping.symbol,
  points,first:first.time,last:last.time,baseline,change:last.value-baseline,change_percent:(last.value/baseline-1)*100,
  source:'Yahoo Finance',interval:historyRanges[period].interval,fetched_at:new Date(now).toISOString(),stale:false};
}

export function createPriceHistoryService(store,{fetcher=fetch,mappings=defaultMappings,now=()=>Date.now()}={}){
 store.db.exec('CREATE TABLE IF NOT EXISTS price_history(instrument_id TEXT NOT NULL REFERENCES instruments(id),period TEXT NOT NULL,payload TEXT NOT NULL,fetched_at INTEGER NOT NULL,PRIMARY KEY(instrument_id,period))');
 const active=new Map(),failures=new Map();let blockedUntil=Number(store.db.prepare("SELECT value FROM meta WHERE key='history_blocked_until'").get()?.value)||0;
 async function load(id,period){
  if(!Object.hasOwn(historyRanges,period))throw error('Nieprawidłowy zakres wykresu',400);
  if(!store.db.prepare('SELECT id FROM instruments WHERE id=?').get(id))throw error('Nieznany podmiot',404);
  const mapping=mappings.find(m=>m.instrument_id===id);if(!mapping)throw error('Brak potwierdzonego źródła wykresu',404);
  const key=id+'/'+period,stamp=now(),cached=store.db.prepare('SELECT payload,fetched_at FROM price_history WHERE instrument_id=? AND period=?').get(id,period);
  let previous;try{previous=cached?JSON.parse(cached.payload):null;}catch{previous=null;}
  if(previous&&stamp>=cached.fetched_at&&stamp-cached.fetched_at<historyRanges[period].ttl)return previous;
  const fallback=message=>{if(previous)return {...previous,stale:true,warning:message};throw error(message);};
  if(stamp<blockedUntil)return fallback('Źródło czasowo wstrzymało pobieranie.');
  if((failures.get(key)||0)>stamp)return fallback('Nie udało się odświeżyć wykresu. Spróbuj później.');
  if(active.has(key))return active.get(key);
  if(active.size>=2)throw error('Trwa pobieranie wykresów. Spróbuj za chwilę.',429);
  const job=(async()=>{
   try{
    const options=historyRanges[period],url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(mapping.symbol)+'?range='+options.range+'&interval='+options.interval+'&includePrePost=false';
    const {text}=await boundedFetch(url,{Accept:'application/json'},fetcher);
    const result=parseHistory(JSON.parse(text),mapping,period,now());
    store.db.prepare('INSERT INTO price_history VALUES(?,?,?,?) ON CONFLICT(instrument_id,period) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').run(id,period,JSON.stringify(result),now());
    failures.delete(key);return result;
   }catch(e){
    if(/HTTP (401|403|429)/.test(e.message)){
     blockedUntil=now()+30*60000;store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('history_blocked_until',?)").run(String(blockedUntil));
    }
    if(failures.size>1000)failures.clear();failures.set(key,now()+2*60000);
    if(previous)return {...previous,stale:true,warning:'Nie udało się odświeżyć wykresu. Widoczne zapisane dane.'};
    if(e.status===404)throw e;
    throw error('Wykres jest chwilowo niedostępny.');
   }finally{active.delete(key);}
  })();active.set(key,job);return job;
 }
 return {load};
}
