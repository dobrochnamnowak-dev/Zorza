import {createArticleReader} from './article-reader.mjs';
import {isoNow,publicationSince} from './core.mjs';

export async function checkPublicationAccess(store,{fetcher=fetch,deadline=Date.now()+180000,instrumentIds=null,reader=null}={}){
 const db=store.db,now=isoNow();reader??=createArticleReader(store,{fetcher});
 const articles=db.prepare(`SELECT a.*,i.name,i.type,i.group_name,i.ticker FROM articles a JOIN instruments i ON i.id=a.instrument_id WHERE a.deleted_at IS NULL AND a.eligible=1 AND a.published_at>=? AND a.published_at<=? AND (i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)) ORDER BY a.published_at DESC`).all(publicationSince(),now).filter(a=>!instrumentIds||instrumentIds.includes(a.instrument_id));
 const tracked=db.prepare('SELECT 1 FROM instruments i WHERE id=? AND (watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))');
 const report={checked:0,available:0,unavailable:0,unchecked:0};const fetched=new Map();let index=0;
 const save=db.prepare('UPDATE articles SET content_status=?,content_checked_at=?,content_text=?,content_url=? WHERE id=? AND content_hash=? AND deleted_at IS NULL');
 await Promise.all(Array.from({length:2},async()=>{
  while(index<articles.length&&Date.now()<deadline){const a=articles[index++];if(!tracked.get(a.instrument_id))continue;
   // Link i treść są publiczne. Analiza AI nie jest tu uruchamiana.
   const key=a.url+'\n'+a.content_hash;
   if(!fetched.has(key))fetched.set(key,reader.read(a,{id:a.instrument_id,name:a.name,type:a.type,group_name:a.group_name,ticker:a.ticker}));
   let source;try{source=await fetched.get(key);}catch{source={basis:'headline',text:'',url:a.url};}
   if(!tracked.get(a.instrument_id))continue;
   const available=source.basis==='article';
   save.run(available?'available':'unavailable',isoNow(),available?source.text:null,available?source.url:null,a.id,a.content_hash);
   report.checked++;report[available?'available':'unavailable']++;
  }
 }));
 report.unchecked=articles.length-report.checked;return report;
}
