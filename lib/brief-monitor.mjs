import {digest} from './core.mjs';
import {issuerDomains} from './issuer-sources.mjs';
export const BRIEF_ENDS_AT='2027-05-04T21:59:59.999Z';
export function sixMonthExpiry(value){
 const d=new Date(value);if(!Number.isFinite(d.getTime()))throw Error('Brak daty publikacji');
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+6);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();
}
export function initBriefMonitor(db){db.exec(`
 CREATE TABLE IF NOT EXISTS brief_monitors(instrument_id TEXT PRIMARY KEY REFERENCES instruments(id),active INTEGER NOT NULL,activated_at TEXT NOT NULL,needs_check INTEGER NOT NULL DEFAULT 1,domains_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS brief_seen(article_id TEXT NOT NULL,revision TEXT NOT NULL,instrument_id TEXT NOT NULL,signature TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(article_id,revision));
 CREATE TABLE IF NOT EXISTS brief_entries(id TEXT PRIMARY KEY,instrument_id TEXT NOT NULL,kind TEXT NOT NULL,text TEXT NOT NULL,date TEXT,certainty TEXT,sources_json TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS brief_seen_instrument ON brief_seen(instrument_id,signature);
 `);
 for(const [name,type] of [['date_precision',"TEXT NOT NULL DEFAULT 'day'"],['event_end_date','TEXT']])if(!db.prepare('PRAGMA table_info(brief_entries)').all().some(c=>c.name===name))db.exec(`ALTER TABLE brief_entries ADD COLUMN ${name} ${type}`);
}
export function syncBriefMonitors(db,now=new Date()){
 const started=[];
 for(const i of db.prepare('SELECT i.*,(i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)) is_personal FROM instruments i').all()){
  const old=db.prepare('SELECT * FROM brief_monitors WHERE instrument_id=?').get(i.id),active=!!i.is_personal&&now.toISOString()<=BRIEF_ENDS_AT;
  if(active&&(!old||!old.active)){
   db.prepare('INSERT INTO brief_monitors VALUES(?,1,?,1,?) ON CONFLICT(instrument_id) DO UPDATE SET active=1,activated_at=excluded.activated_at,needs_check=1,domains_json=excluded.domains_json').run(i.id,now.toISOString(),JSON.stringify(issuerDomains(i)));started.push(i.id);
  }else if(!active&&old?.active){
   db.prepare('UPDATE brief_monitors SET active=0,needs_check=0 WHERE instrument_id=?').run(i.id);
   db.prepare("UPDATE insight_jobs SET status='superseded' WHERE instrument_id=? AND status IN('queued','running')").run(i.id);
   db.prepare("UPDATE company_insights SET last_slot=NULL,status=CASE WHEN content_json IS NULL THEN 'empty' ELSE 'done' END WHERE instrument_id=?").run(i.id);
  }
 }
 return started;
}
export const briefSignature=(title,excerpt='')=>digest((title+'\n'+excerpt.slice(0,400)).toLowerCase().replace(/\s+/g,' ').trim());
export function newBriefArticles(db,id,now=new Date(),limit=20){
 const monitor=db.prepare('SELECT * FROM brief_monitors WHERE instrument_id=? AND active=1').get(id);
 if(!monitor||now.toISOString()>BRIEF_ENDS_AT)return [];
 const result=[],unique=new Set();
 for(const a of db.prepare("SELECT * FROM articles WHERE instrument_id=? AND eligible=1 AND deleted_at IS NULL AND publication_kind!='research' AND published_at>=? AND published_at<=? ORDER BY published_at,id").all(id,monitor.activated_at,now.toISOString())){
  const signature=briefSignature(a.title,a.excerpt||'');
  if(sixMonthExpiry(a.published_at)<=now.toISOString()||unique.has(signature)||db.prepare('SELECT 1 FROM brief_seen WHERE instrument_id=? AND ((article_id=? AND revision=?) OR (article_id<>? AND signature=?))').get(id,a.id,a.content_hash,a.id,signature))continue;
  unique.add(signature);result.push(a);if(result.length===limit)break;
 }
 return result;
}
export function rememberBriefBatch(db,id,articles,status){
 for(const a of articles)db.prepare('INSERT OR REPLACE INTO brief_seen VALUES(?,?,?,?,?)').run(a.id,a.revision||a.content_hash,id,briefSignature(a.title,a.excerpt||''),status);
}
export function appendBrief(db,id,value,articles,now=new Date()){
 const sources=new Map(articles.map(a=>[a.id,a]));let added=0;
 for(const kind of ['events','actions','deadlines'])for(const item of value[kind]||[]){
  const refs=item.sources.map(ref=>sources.get(ref));
  if(refs.some(a=>!a))throw Error('Nowy punkt briefu wymaga nowych źródeł');
  const evidence=refs.map(a=>({id:a.id,revision:a.revision||a.content_hash,url:a.url,title:a.title,published_at:a.published_at,publisher:a.publisher||a.publisher_name||'Źródło'}));
  const expiry=evidence.map(a=>sixMonthExpiry(a.published_at)).sort()[0];
  const key=digest(id+'|'+kind+'|'+(item.date||'')+'|'+item.text.toLowerCase().replace(/\s+/g,' ').trim());
  added+=db.prepare('INSERT OR IGNORE INTO brief_entries(id,instrument_id,kind,text,date,certainty,sources_json,expires_at,created_at,date_precision,event_end_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(key,id,kind,item.text,item.date||null,item.certainty||null,JSON.stringify(evidence),expiry,now.toISOString(),item.precision||'day',item.end_date||null).changes;
 }
 return added;
}
export function briefEntries(db,id,now=new Date()){
 const result=[];
 for(const row of db.prepare('SELECT * FROM brief_entries WHERE instrument_id=? AND expires_at>? ORDER BY created_at DESC,id').all(id,now.toISOString())){
  const refs=JSON.parse(row.sources_json);
  if(refs.some(a=>!db.prepare('SELECT 1 FROM articles WHERE id=? AND content_hash=? AND eligible=1 AND deleted_at IS NULL').get(a.id,a.revision)))continue;
  result.push({...row,sources:refs.map(a=>a.id),source_details:refs});
 }
 return result;
}
export function compactBriefContext(db,id,now=new Date()){
 return briefEntries(db,id,now).slice(0,8).map(e=>({kind:e.kind,text:e.text.slice(0,200),date:e.date}));
}
