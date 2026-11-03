import {saveEventDates} from './event-extraction.mjs';
import { getSettings, included } from './settings.mjs';
import { parseRss, isoNow } from './core.mjs';
import {syncPublicationSources,acceptPublication} from './publication-policy.mjs';

export async function boundedFetch(url, headers={}, fetcher=fetch) {
  const response=await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(response.status===304) return {response,text:null};
  if(!response.ok) throw new Error(`Źródło zwróciło HTTP ${response.status}`);
  if(Number(response.headers.get('content-length') || 0)>2e6) throw new Error('Kanał przekroczył limit wielkości');
  const chunks=[];let size=0;
  for await(const chunk of response.body) {size+=chunk.length;if(size>2e6) throw new Error('Kanał przekroczył limit wielkości');chunks.push(chunk);}
  return {response,text:Buffer.concat(chunks).toString('utf8')};
}
export async function collect(store, {force=false,fetcher=fetch}={}) {
  if(!store.lock('collection',10*60e3)) return {busy:true,added:0,sources:[]};
  const report={added:0,sources:[]};
  try {
    syncPublicationSources(store.db);
    const sources=store.db.prepare('SELECT * FROM sources WHERE enabled=1 ORDER BY instrument_id').all();
    const fetched=new Map(),deadline=Date.now()+8*60000;
    let index=0,blocked=false;
    await Promise.all(Array.from({length:3},async()=>{while(index<sources.length&&!blocked&&Date.now()<deadline){const s=sources[index++];
      const min=force ? 5 : Math.max(15,Number(process.env.COLLECT_INTERVAL_MINUTES)||360);
      if(s.last_checked && Date.now()-Date.parse(s.last_checked)<min*60e3) {report.sources.push({id:s.id,status:'recent'});continue;}
      try {
        const headers={'User-Agent':'SygnalPersonalRSSReader/0.1','Accept':'application/rss+xml, application/xml, text/xml'};
        if(s.etag) headers['If-None-Match']=s.etag;
        if(s.modified) headers['If-Modified-Since']=s.modified;
        if(!fetched.has(s.url))fetched.set(s.url,boundedFetch(s.url,headers,fetcher));
        const {response,text}=await fetched.get(s.url);
        if(text!==null) for(const raw of parseRss(text)) {
          const item=acceptPublication(s,raw);if(!item)continue;
          const result=store.ingest(s,item);
          saveEventDates(store,{...item,id:result.id,instrument_id:s.instrument_id});
          if(result.changed) {
            report.added++;
            // Pobieranie nigdy nie zleca AI; analizę zamawia użytkowniczka.

          }
        }
        store.db.prepare('UPDATE sources SET last_checked=?,last_success=?,error=NULL,etag=?,modified=? WHERE id=?')
          .run(isoNow(),isoNow(),response.headers.get('etag')||s.etag,response.headers.get('last-modified')||s.modified,s.id);
        report.sources.push({id:s.id,status:'ok'});
      } catch(e) {
        store.db.prepare('UPDATE sources SET last_checked=?,error=? WHERE id=?').run(isoNow(),String(e.message).slice(0,250),s.id);
        report.sources.push({id:s.id,status:'error',error:String(e.message).slice(0,250)});
        if(new URL(s.url).hostname==='news.google.com'&&/HTTP (401|403|429)/.test(e.message))blocked=true;
      }
      await new Promise(resolve=>setTimeout(resolve,150));
    }}));
    report.unchecked=sources.length-report.sources.length;
    report.blocked=blocked;
    return report;
  } finally {store.unlock('collection');}
}
