import {initBriefMonitor,syncBriefMonitors,newBriefArticles,rememberBriefBatch,appendBrief,briefEntries,compactBriefContext,sixMonthExpiry,BRIEF_ENDS_AT} from './brief-monitor.mjs';
import {digest} from './core.mjs';
import {validEventWindow,saveInsightDates} from './event-windows.mjs';

export const INSIGHT_VERSION=3;
export const MAX_INSIGHT_ARTICLES=20;
const DAY=86400000;
const personal="(i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))";
export function initInsights(db){
 initBriefMonitor(db);
 db.exec(`CREATE TABLE IF NOT EXISTS company_insights(
 instrument_id TEXT PRIMARY KEY REFERENCES instruments(id),input_hash TEXT,content_json TEXT,
 material_hash TEXT,seen_hash TEXT,checked_at TEXT,generated_at TEXT,changed_at TEXT,last_slot TEXT,
 status TEXT NOT NULL DEFAULT 'empty',error TEXT);
 CREATE TABLE IF NOT EXISTS insight_jobs(
 id TEXT PRIMARY KEY,instrument_id TEXT NOT NULL REFERENCES instruments(id),input_hash TEXT NOT NULL,
 input_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,started_at TEXT,error TEXT,
 UNIQUE(instrument_id,input_hash));`);
}
export function insightSlot(isPersonal,now=new Date()){
 if(!isPersonal)return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 const day=`${p.year}-${p.month}-${p.day}`,minute=Number(p.hour)*60+Number(p.minute);
 return ['Mon','Thu'].includes(p.weekday)&&minute>=870?day+'/14:30':null;
}
export function insightInput(db,instrumentId,now=new Date(),{initial=false}={}){
 const instrument=db.prepare('SELECT id,name,type,group_name FROM instruments WHERE id=?').get(instrumentId);
 if(!instrument)throw Error('Nieznany podmiot');
 const from=db.prepare('SELECT activated_at FROM brief_monitors WHERE instrument_id=?').get(instrumentId)?.activated_at||now.toISOString(),to=now.toISOString();
 const fresh=newBriefArticles(db,instrumentId,now,MAX_INSIGHT_ARTICLES);
 const historyFrom=new Date(now.getTime()-14*DAY).toISOString();
 const eligible=initial?db.prepare("SELECT * FROM articles WHERE instrument_id=? AND eligible=1 AND deleted_at IS NULL AND publication_kind!='research' AND published_at>=? AND published_at<=? ORDER BY published_at DESC,id LIMIT ?").all(instrumentId,historyFrom,to,MAX_INSIGHT_ARTICLES):fresh;
 const unique=new Map(eligible.map(a=>[a.id,a]));
 // Use already cached public text, without fetching or summarising whole articles again.
 // The total evidence budget stays at 8,000 characters per batch.
 const perArticle=Math.min(1600,Math.floor(8000/Math.max(1,unique.size)));
 const articles=[...unique.values()].slice(0,MAX_INSIGHT_ARTICLES).map(a=>{
  const cached=a.content_status==='available'&&a.content_text;
  return {id:a.id,revision:a.content_hash,title:a.title.slice(0,300),excerpt:(cached||a.excerpt||'').slice(0,perArticle),url:a.url,published_at:a.published_at,publisher:a.publisher_name||'Źródło',kind:a.publication_kind,basis:cached?'fragment tekstu artykułu':a.excerpt?'fragment RSS':'nagłówek'};
 });
 const ids=articles.map(a=>a.id);
 let events=ids.length?db.prepare(`SELECT id,article_id,title,event_date,certainty,evidence,date_precision precision,event_end_date end_date FROM events WHERE article_id IN(${ids.map(()=>'?').join(',')}) AND review_status='approved' AND COALESCE(event_end_date,event_date)>=? ORDER BY event_date,id LIMIT 10`).all(...ids,to.slice(0,10)).map(e=>({...e,title:e.title.slice(0,180),evidence:e.evidence.slice(0,200)})):[];
 // Keep room for saved compact context; never truncate links or send an oversized task.
 while(articles.length>1&&JSON.stringify({instrument,articles,events}).length>20000){articles.pop();const kept=new Set(articles.map(a=>a.id));events=events.filter(e=>kept.has(e.article_id));}
 // The rolling clock and changing price are not reasons to spend tokens again.
 // A quote alone cannot establish why the market moved.
 const fingerprint={version:INSIGHT_VERSION,instrument,articles,events,initial,brief_article_ids:initial?articles.filter(a=>fresh.some(f=>f.id===a.id)).map(a=>a.id):articles.map(a=>a.id)};
 return {...fingerprint,input_hash:digest(JSON.stringify(fingerprint)),as_of:to,window_from:initial?historyFrom:from,monitor_activated_at:from,total_articles:eligible.length,selected_articles:articles.length};
}
export function queueInsights(store,{now=new Date(),scope='disabled'}={}){
 if(scope==='disabled')return {queued:0,checked:0};
 syncBriefMonitors(store.db,now);
 const db=store.db,rows=db.prepare(`SELECT i.id,${personal} is_personal FROM instruments i ORDER BY is_personal DESC,i.name`).all();
 let queued=0,checked=0;
 for(const i of rows){
  if(!i.is_personal||now.toISOString()>BRIEF_ENDS_AT)continue;
  const old=db.prepare('SELECT * FROM company_insights WHERE instrument_id=?').get(i.id);
  const initial=!old?.generated_at&&!['failed','queued','running'].includes(old?.status);
  const slot=insightSlot(!!i.is_personal,now);if(!slot&&!initial)continue;
  const key=initial?'initial:'+db.prepare('SELECT activated_at FROM brief_monitors WHERE instrument_id=?').get(i.id)?.activated_at:'twice-weekly:'+slot;
  if(old?.last_slot===key)continue;
  const input=insightInput(db,i.id,now,{initial}),stamp=now.toISOString();checked++;
  db.prepare(`INSERT INTO company_insights(instrument_id,checked_at,last_slot) VALUES(?,?,?) ON CONFLICT(instrument_id) DO UPDATE SET checked_at=excluded.checked_at,last_slot=excluded.last_slot`).run(i.id,stamp,input.articles.length?key:null);
  if(!input.articles.length)continue;
  if(old?.input_hash===input.input_hash)continue;
  const id=digest(i.id+'|'+input.input_hash);
  const result=db.prepare("INSERT OR IGNORE INTO insight_jobs(id,instrument_id,input_hash,input_json,status,created_at) VALUES(?,?,?,?,'queued',?)").run(id,i.id,input.input_hash,JSON.stringify(input),stamp);
  if(result.changes){rememberBriefBatch(db,i.id,input.articles.filter(a=>!input.initial||input.brief_article_ids.includes(a.id)),'queued');queued++;db.prepare("UPDATE company_insights SET status='queued',error=NULL WHERE instrument_id=?").run(i.id);}
 }
 return {queued,checked};
}
const text=s=>typeof s==='string'&&s.trim().length>0&&s.length<=700;
export function validateInsight(value,input){
 if(!value||typeof value.material_changed!=='boolean')throw Error('Niepoprawny opis');
 const refs=new Map(input.articles.map(a=>[a.id,a]));
 const check=(item,dated=false)=>{
  if(!item||!text(item.text)||!Array.isArray(item.sources)||!item.sources.length||item.sources.length>4||new Set(item.sources).size!==item.sources.length||item.sources.some(id=>!refs.has(id)))throw Error('Opis wymaga źródeł z przekazanych materiałów');
  if(dated){
   if(!['confirmed','estimated'].includes(item.certainty)||!validEventWindow(item))throw Error('Niepoprawny termin');
   const event=input.events.find(e=>item.sources.includes(e.article_id)&&e.event_date===item.date&&e.certainty===item.certainty&&(e.precision||'day')===(item.precision||'day')&&(e.end_date||null)===(item.end_date||null));
   if(!event)throw Error('Termin nie ma potwierdzenia w kalendarzu źródłowym');
  }
 };
 check(value.overview);
 if(value.conclusion)check(value.conclusion);
 if(value.situation_dates){if(!Array.isArray(value.situation_dates)||value.situation_dates.length>10)throw Error('Za dużo terminów opisu');value.situation_dates.forEach(item=>check(item,true));}
 if(value.followups&&(!Array.isArray(value.followups)||value.followups.length>3||value.followups.some(s=>typeof s!=='string'||s.length>200)))throw Error('Niepoprawne propozycje');
 for(const key of ['drivers','risks','events','actions','deadlines']){
  if(!Array.isArray(value[key])||value[key].length>4)throw Error('Opis przekracza limit');
  value[key].forEach(item=>check(item,key==='deadlines'));
  if(['events','actions','deadlines'].includes(key)&&Array.isArray(input.brief_article_ids)&&value[key].some(item=>item.sources.some(id=>!input.brief_article_ids.includes(id))))throw Error('Brief nie może uzupełniać historii pierwszego opisu');
 }
 if(typeof value.price_context!=='string'||value.price_context.length>400||typeof value.limitations!=='string'||value.limitations.length>400||JSON.stringify(value).length>6500)throw Error('Opis przekracza limit');
 return value;
}
export function insightFor(db,instrumentId,now=new Date()){
 const row=db.prepare('SELECT * FROM company_insights WHERE instrument_id=?').get(instrumentId);
 if(!row)return {status:'pending',unread:false};
 const job=db.prepare('SELECT input_json FROM insight_jobs WHERE instrument_id=? AND input_hash=?').get(instrumentId,row.input_hash);
 const input=job?JSON.parse(job.input_json):null;
 const content=row.content_json?JSON.parse(row.content_json):null;
 const from=new Date(now);from.setUTCMonth(from.getUTCMonth()-7);
 const currentRows=new Map(db.prepare('SELECT id,content_hash FROM articles WHERE instrument_id=? AND eligible=1 AND deleted_at IS NULL AND published_at>=? AND published_at<=?').all(instrumentId,from.toISOString(),now.toISOString()).map(a=>[a.id,a.content_hash]));
 const sources=(input?.articles||[]).filter(a=>currentRows.get(a.id)===a.revision&&sixMonthExpiry(a.published_at)>now.toISOString());
 const currentSources=new Set(sources.map(a=>a.id));
 const valid=content&&[content.overview,...content.drivers,...content.risks,...(content.conclusion?[content.conclusion]:[]),...(content.situation_dates||[])].every(item=>item.sources.every(id=>currentSources.has(id)));
 const entries=briefEntries(db,instrumentId,now);
 const merged=valid?{...content}:{overview:{text:'Brak aktualnego opisu potwierdzonego źródłami.',sources:[]},drivers:[],risks:[],price_context:'',limitations:''};
 for(const key of ['events','actions','deadlines'])merged[key]=entries.filter(e=>e.kind===key).map(e=>({text:e.text,sources:e.sources,...(e.date?{date:e.date,certainty:e.certainty,precision:e.date_precision||'day',...(e.event_end_date?{end_date:e.event_end_date}:{})}:{})}));
 const allSources=[...new Map([...sources,...entries.flatMap(e=>e.source_details)].map(a=>[a.id,a])).values()];
 return {status:row.status,checked_at:row.checked_at,generated_at:row.generated_at,changed_at:row.changed_at,material_hash:row.material_hash,
 unread:!!(valid||entries.length)&&row.material_hash!==row.seen_hash,content:valid||entries.length?merged:null,stale:!!content&&!valid,error:row.error,sources:allSources,
 total_articles:input?.total_articles||0,selected_articles:input?.selected_articles||0,retention_months:6};
}
export function markInsightRead(db,id,hash){
 if(typeof hash!=='string'||hash.length!==64)throw Error('Niepoprawna wersja opisu');
 return db.prepare('UPDATE company_insights SET seen_hash=? WHERE instrument_id=? AND material_hash=?').run(hash,id,hash).changes;
}
export function retryInsight(db,id){
 const row=db.prepare('SELECT input_hash,status FROM company_insights WHERE instrument_id=?').get(id);
 if(!row)throw Error('Brak opisu do ponowienia');
 if(!db.prepare(`SELECT 1 FROM instruments i JOIN brief_monitors b ON b.instrument_id=i.id WHERE i.id=? AND b.active=1 AND ${personal}`).get(id))throw Error('Monitoring podmiotu jest wyłączony');
 // Explicit correction of the latest result only, never an automatic replay of history.
 const job=row.status==='failed'?db.prepare("SELECT id FROM insight_jobs WHERE instrument_id=? AND status='failed' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(id):row.status==='done'?db.prepare("SELECT id FROM insight_jobs WHERE instrument_id=? AND input_hash=? AND status='done'").get(id,row.input_hash):null;
 const result=job?db.prepare("UPDATE insight_jobs SET status='queued',started_at=NULL,error=NULL WHERE id=? AND status IN('failed','done')").run(job.id):{changes:0};
 if(!result.changes)throw Error('Opracowanie już oczekuje lub wymaga nowych materiałów');
 db.prepare("UPDATE company_insights SET status='queued',error=NULL WHERE instrument_id=?").run(id);
}
export async function processInsightWork(store,{runModel,available=async()=>true,now=new Date(),scope='disabled'}={}){
 if(!runModel||scope==='disabled'||now.toISOString()>BRIEF_ENDS_AT)return {status:'disabled'};
 if(!store.lock('insight-work',5*60000))return {status:'busy'};
 const db=store.db;
 try{
  db.prepare("UPDATE company_insights SET status='failed',error='Przerwane opracowanie. Ponów ręcznie.' WHERE instrument_id IN(SELECT instrument_id FROM insight_jobs WHERE status='running' AND started_at<?)").run(new Date(now.getTime()-5*60000).toISOString());
  db.prepare("UPDATE insight_jobs SET status='failed',error='Przerwane opracowanie. Ponów ręcznie.' WHERE status='running' AND started_at<?").run(new Date(now.getTime()-5*60000).toISOString());
  const job=db.prepare(`SELECT j.* FROM insight_jobs j JOIN instruments i ON i.id=j.instrument_id WHERE j.status='queued' AND ${personal} ORDER BY j.created_at,j.id LIMIT 1`).get();
  if(!job)return {status:'empty'};
  const stored=JSON.parse(job.input_json);
  const validBatch=()=>{const monitor=db.prepare('SELECT activated_at FROM brief_monitors WHERE instrument_id=? AND active=1').get(job.instrument_id);return !!monitor&&(!stored.monitor_activated_at||monitor.activated_at===stored.monitor_activated_at)&&stored.articles.every(a=>a.published_at>=(stored.initial?stored.window_from:monitor.activated_at)&&sixMonthExpiry(a.published_at)>now.toISOString()&&db.prepare('SELECT 1 FROM articles WHERE id=? AND content_hash=? AND eligible=1 AND deleted_at IS NULL').get(a.id,a.revision));};
  if(!validBatch()){db.prepare("UPDATE insight_jobs SET status='superseded' WHERE id=?").run(job.id);db.prepare("UPDATE company_insights SET last_slot=NULL WHERE instrument_id=?").run(job.instrument_id);return {status:'superseded'};}
  if(!await available())return {status:'busy'};
  db.prepare("UPDATE insight_jobs SET status='running',started_at=? WHERE id=?").run(now.toISOString(),job.id);
  db.prepare("UPDATE company_insights SET status='running' WHERE instrument_id=?").run(job.instrument_id);
  const old=db.prepare('SELECT * FROM company_insights WHERE instrument_id=?').get(job.instrument_id);
  try{
   const previous=old.content_json?JSON.parse(old.content_json):null;
   const result=validateInsight(await runModel({kind:'insight',...stored,previous:previous?{overview:previous.overview.text.slice(0,400),drivers:previous.drivers.map(x=>x.text.slice(0,180)),risks:previous.risks.map(x=>x.text.slice(0,180))}:null,previous_brief:compactBriefContext(db,job.instrument_id,now)}),stored);
   // Never publish a result for a superseded or removed source set.
   if(!validBatch()||db.prepare('SELECT status FROM insight_jobs WHERE id=?').get(job.id)?.status!=='running')throw Error('Materiały zmieniły się podczas opracowania');
   const {material_changed,...content}=result;
   const hadContent=!!old.content_json,changed=!hadContent||material_changed||insightFor(db,job.instrument_id,now).stale;
   saveInsightDates(db,job.instrument_id,result,stored,now);
   // The description may be unchanged while the brief contains a new event.
   const added=appendBrief(db,job.instrument_id,result,stored.articles,now);
   rememberBriefBatch(db,job.instrument_id,stored.articles.filter(a=>!stored.initial||stored.brief_article_ids?.includes(a.id)),'done');
   const material=changed||added?digest(JSON.stringify(content)+now.toISOString()):old.material_hash;
   db.prepare("UPDATE company_insights SET input_hash=?,content_json=?,material_hash=?,generated_at=?,changed_at=?,status='done',error=NULL WHERE instrument_id=?").run(changed?job.input_hash:old.input_hash,changed?JSON.stringify(content):old.content_json,material,changed?now.toISOString():old.generated_at,changed||added?now.toISOString():old.changed_at,job.instrument_id);
   db.prepare("UPDATE insight_jobs SET status='done' WHERE id=?").run(job.id);
   return {status:'done',id:job.instrument_id,changed:!!(changed||added)};
  }catch(error){
   db.prepare("UPDATE insight_jobs SET status='failed',error=? WHERE id=? AND status='running'").run(String(error.message).slice(0,250),job.id);
   db.prepare("UPDATE company_insights SET status='failed',error='Nie udało się opracować opisu. Ponów ręcznie.' WHERE instrument_id=?").run(job.instrument_id);
   return {status:'failed',id:job.instrument_id};
  }
 }finally{store.unlock('insight-work');}
}
