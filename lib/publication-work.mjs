import {digest,isoNow,validateSummary} from './core.mjs';
import {articleText} from './article-text.mjs';

const personal="(i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))";
export const localDay=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function headlineStatus(db,now=new Date()){
 const budget=Number(db.prepare('SELECT value FROM meta WHERE key=?').get('headline-budget/'+localDay(now))?.value||0);
 const pending=db.prepare(`SELECT COUNT(*) n FROM articles a JOIN instruments i ON i.id=a.instrument_id WHERE a.eligible=1 AND a.deleted_at IS NULL AND a.title_pl IS NULL AND a.translation_state='queued' AND ${personal}`).get().n;
 return {used:budget,limit:100,pending};
}
export async function processPublicationWork(store,{runModel,available=async()=>true,fetcher=fetch,now=new Date()}={}){
 if(!runModel)return {status:'disabled'};
 if(!store.lock('publication-work',4*60000))return {status:'busy'};
 const db=store.db;
 try{
  db.prepare("UPDATE jobs SET status='failed',error='Przerwane opracowanie — ponów ręcznie',finished_at=? WHERE status='running' AND lease_until<?").run(isoNow(),isoNow());
  db.prepare("UPDATE jobs SET status='failed',error='Źródło nie spełnia zasad zagranicznej prasówki' WHERE status='queued' AND article_id IN(SELECT id FROM articles WHERE eligible=0)").run();
  db.prepare("UPDATE articles SET translation_state='failed',translation_error='Przerwane tłumaczenie — ponów ręcznie' WHERE translation_state='running' AND translation_started<?").run(new Date(Date.now()-5*60000).toISOString());
  const candidates=db.prepare(`SELECT a.* FROM articles a JOIN instruments i ON i.id=a.instrument_id WHERE a.eligible=1 AND a.deleted_at IS NULL AND a.title_pl IS NULL AND a.published_at<=? AND ${personal} ORDER BY a.published_at DESC`).all(isoNow());
  const unique=new Map();
  for(const a of candidates){const hash=digest(a.title);const cached=db.prepare('SELECT title_pl FROM headline_cache WHERE hash=?').get(hash);if(cached){db.prepare("UPDATE articles SET title_pl=?,translation_state='done',translation_error=NULL WHERE id=? AND title=?").run(cached.title_pl,a.id,a.title);}else if(a.translation_state==='queued'&&!unique.has(hash))unique.set(hash,{id:hash,title:a.title});}
  const hasSummary=!!db.prepare("SELECT 1 FROM jobs j JOIN articles a ON a.id=j.article_id WHERE j.status='queued' AND j.user_requested=1 AND a.eligible=1 AND a.deleted_at IS NULL AND j.content_hash=a.content_hash LIMIT 1").get();
  const budgetKey='headline-budget/'+localDay(now),used=Number(db.prepare('SELECT value FROM meta WHERE key=?').get(budgetKey)?.value||0);
  const items=[...unique.values()].slice(0,Math.max(0,Math.min(20,100-used)));
  if(!hasSummary&&!items.length)return {status:unique.size?'daily_limit':'empty'};
  if(!await available())return {status:'busy'};
  if(hasSummary){
   const {job,reason}=store.claim(300);if(!job)return {status:reason};
   try{
    if(!job.eligible)throw Error('Źródło publikacji wymaga weryfikacji');
    const instrument=db.prepare('SELECT * FROM instruments WHERE id=?').get(job.instrument_id);
    const source=await articleText(job,instrument,{fetcher});
    const result=await runModel({kind:'summary',article:{instrument:job.instrument_name,title:job.title,text:source.text,basis:source.basis,published_at:job.published_at,url:source.url}});
    validateSummary(result,{...job,excerpt:job.excerpt+' '+source.text});
    store.finish(job.id,job.lease,result,null,source.text);
    db.prepare('UPDATE articles SET summary_basis=? WHERE id=? AND content_hash=?').run(source.basis,job.article_id,job.content_hash);
    return {status:'summary',id:job.article_id};
   }catch(e){store.finish(job.id,job.lease,null,String(e.message));return {status:'failed'};}
  }
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(budgetKey,String(used+items.length));
  const mark=db.prepare(`UPDATE articles SET translation_state='running',translation_started=? WHERE title=? AND title_pl IS NULL AND eligible=1 AND instrument_id IN(SELECT i.id FROM instruments i WHERE ${personal})`);
  for(const item of items)mark.run(isoNow(),item.title);
  try{
   const result=await runModel({kind:'titles',items});
   if(!Array.isArray(result.items)||result.items.length!==items.length||new Set(result.items.map(i=>i.id)).size!==items.length||result.items.some(i=>!items.some(a=>a.id===i.id)||typeof i.title_pl!=='string'||!i.title_pl.trim()||i.title_pl.length>700))throw Error('Niepoprawne tłumaczenie');
   for(const item of result.items){const original=items.find(i=>i.id===item.id).title;
    db.prepare('INSERT OR REPLACE INTO headline_cache(hash,original,title_pl,created_at) VALUES(?,?,?,?)').run(item.id,original,item.title_pl,isoNow());
    db.prepare(`UPDATE articles SET title_pl=?,translation_state='done',translation_error=NULL WHERE title=? AND eligible=1 AND instrument_id IN(SELECT i.id FROM instruments i WHERE ${personal})`).run(item.title_pl,original);
   }
   return {status:'titles',count:items.length};
  }catch(e){for(const item of items)db.prepare("UPDATE articles SET translation_state='failed',translation_error=? WHERE title=? AND translation_state='running'").run(String(e.message).slice(0,250),item.title);return {status:'failed'};}
 }finally{store.unlock('publication-work');}
}
