import {isoNow,validateSummary} from './core.mjs';
import {articleText} from './article-text.mjs';

// Original headlines are immediately available; no translation queue or AI budget.
export function headlineStatus(){return {enabled:false,mode:'original',used:0,limit:0,pending:0};}
export async function processPublicationWork(store,{runModel,available=async()=>true,fetcher=fetch,now=new Date()}={}){
 if(!runModel)return {status:'disabled'};
 if(!store.lock('publication-work',4*60000))return {status:'busy'};
 const db=store.db;
 try{
  db.prepare("UPDATE jobs SET status='failed',error='Przerwane opracowanie — ponów ręcznie',finished_at=? WHERE status='running' AND lease_until<?").run(isoNow(),isoNow());
  db.prepare("UPDATE jobs SET status='failed',error='Źródło nie spełnia zasad zagranicznej prasówki' WHERE status='queued' AND article_id IN(SELECT id FROM articles WHERE eligible=0)").run();
  const hasSummary=!!db.prepare("SELECT 1 FROM jobs j JOIN articles a ON a.id=j.article_id WHERE j.status='queued' AND j.user_requested=1 AND a.eligible=1 AND a.deleted_at IS NULL AND j.content_hash=a.content_hash LIMIT 1").get();
  if(!hasSummary)return {status:'empty'};
  if(!await available())return {status:'busy'};
  if(hasSummary){
   const {job,reason}=store.claim(300);if(!job)return {status:reason};
   try{
    if(!job.eligible)throw Error('Źródło publikacji wymaga weryfikacji');
    const instrument=db.prepare('SELECT * FROM instruments WHERE id=?').get(job.instrument_id);
    const source=job.content_status==='available'&&job.content_text&&Date.now()-Date.parse(job.content_checked_at)<86400000?{basis:'article',text:job.content_text,url:job.content_url||job.url}:await articleText(job,instrument,{fetcher});
    db.prepare('UPDATE articles SET content_status=?,content_checked_at=?,content_text=?,content_url=? WHERE id=? AND content_hash=?').run(source.basis==='article'?'available':'unavailable',isoNow(),source.basis==='article'?source.text:null,source.basis==='article'?source.url:null,job.article_id,job.content_hash);
    db.prepare('UPDATE articles SET summary_basis=? WHERE id=? AND content_hash=?').run(source.basis,job.article_id,job.content_hash);
    if(source.basis!=='article'){throw Error('Nie mam dostępu do treści artykułu. Dostępny jest tylko nagłówek lub fragment — podsumowanie nie zostało wygenerowane.');}
    const result=await runModel({kind:'summary',article:{instrument:job.instrument_name,title:job.title,text:source.text,basis:source.basis,published_at:job.published_at,url:source.url}});
    validateSummary(result,{...job,excerpt:job.excerpt+' '+source.text});
    store.finish(job.id,job.lease,result,null,source.text);
    return {status:'summary',id:job.article_id};
   }catch(e){store.finish(job.id,job.lease,null,String(e.message));return {status:'failed'};}
  }
 }finally{store.unlock('publication-work');}
}
