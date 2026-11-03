import {saveEventDates} from './event-extraction.mjs';
import {articleText} from './article-text.mjs';
export async function collectCalendarDates(store,{fetcher=fetch,now=new Date()}={}){
 if(!store.lock('calendar-fetch',3*60000))return {busy:true};
 let dates=0,pages=0;const deadline=Date.now()+2*60000;
 try{
  const articles=store.db.prepare("SELECT * FROM articles WHERE eligible=1 AND deleted_at IS NULL AND published_at<=? AND published_at>=? ORDER BY published_at DESC").all(now.toISOString(),new Date(now.getTime()-35*86400000).toISOString());
  for(const a of articles)dates+=saveEventDates(store,a,now);
  const candidates=articles.filter(a=>a.publication_kind==='press'&&/results|earnings|annual report|conference call|investor day|dividend|distribution|rebalance|shareholder|fund notice/i.test(a.title)&&store.db.prepare('SELECT 1 FROM instruments i WHERE id=? AND (watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))').get(a.instrument_id)).slice(0,12);
  let index=0;
  await Promise.all(Array.from({length:2},async()=>{while(index<candidates.length&&Date.now()<deadline){const a=candidates[index++];const key='calendar-page/'+now.toISOString().slice(0,10)+'/'+a.id;if(store.db.prepare('SELECT 1 FROM meta WHERE key=?').get(key))continue;
   store.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,'checked');
   const i=store.db.prepare('SELECT * FROM instruments WHERE id=?').get(a.instrument_id);const source=await articleText(a,i,{fetcher});pages++;
   if(source.basis==='article')dates+=saveEventDates(store,{...a,excerpt:source.text,source_url:source.url},now);
  }}));
  const report={checked_at:now.toISOString(),dates,pages};store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('calendar_report',?)").run(JSON.stringify(report));return report;
 }finally{store.unlock('calendar-fetch');}
}
