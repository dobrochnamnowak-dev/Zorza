import {retireArticleSummaries} from './publication-work.mjs';
import {syncPublicationSources} from './publication-policy.mjs';
import {initInsights} from './company-insights.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { digest, isoNow, utcDay, validateSummary } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function createStore(path, catalog) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS instruments(id TEXT PRIMARY KEY,name TEXT,type TEXT,ticker TEXT,group_name TEXT,watched INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,instrument_id TEXT REFERENCES instruments(id),name TEXT,url TEXT,home TEXT,last_checked TEXT,last_success TEXT,error TEXT,etag TEXT,modified TEXT);
    CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY,instrument_id TEXT REFERENCES instruments(id),source_id TEXT REFERENCES sources(id),title TEXT,url TEXT,excerpt TEXT,published_at TEXT,discovered_at TEXT,updated_at TEXT,category TEXT,content_hash TEXT,read_at TEXT,summary TEXT,significance TEXT,ai_at TEXT,UNIQUE(instrument_id,url));
    CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,article_id TEXT,content_hash TEXT,title TEXT,excerpt TEXT,recorded_at TEXT);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,article_id TEXT REFERENCES articles(id),content_hash TEXT,status TEXT,created_at TEXT,started_at TEXT,finished_at TEXT,lease TEXT,lease_until TEXT,error TEXT,UNIQUE(article_id,content_hash));
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,article_id TEXT REFERENCES articles(id),title TEXT,event_date TEXT,certainty TEXT,evidence TEXT,review_status TEXT DEFAULT 'pending',created_at TEXT);
    CREATE TABLE IF NOT EXISTS locks(id TEXT PRIMARY KEY,until_at INTEGER);
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,job_id TEXT,started_at TEXT);
    CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY,instrument_id TEXT REFERENCES instruments(id),quantity REAL NOT NULL,price REAL NOT NULL,currency TEXT NOT NULL,purchased_on TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS instrument_comments(id TEXT PRIMARY KEY,instrument_id TEXT NOT NULL REFERENCES instruments(id),text TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quotes(instrument_id TEXT PRIMARY KEY REFERENCES instruments(id),price REAL,change_percent REAL,currency TEXT,as_of TEXT,source TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires INTEGER);
  `);
  if(!db.prepare('PRAGMA table_info(articles)').all().some(c=>c.name==='title_pl'))db.exec('ALTER TABLE articles ADD COLUMN title_pl TEXT');
  for(const [name,definition] of [['starred','INTEGER NOT NULL DEFAULT 0'],['deleted_at','TEXT']])if(!db.prepare('PRAGMA table_info(articles)').all().some(c=>c.name===name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  if(!db.prepare('PRAGMA table_info(jobs)').all().some(c=>c.name==='user_requested')){
    db.exec('ALTER TABLE jobs ADD COLUMN user_requested INTEGER NOT NULL DEFAULT 0');
    db.prepare("UPDATE jobs SET status='failed',error='Wymagane ponowne zlecenie przez użytkowniczkę' WHERE status='queued'").run();
  }
  for(const [name,definition] of [['content_status','TEXT'],['content_checked_at','TEXT'],['content_text','TEXT'],['content_url','TEXT'],['eligible','INTEGER NOT NULL DEFAULT 0'],['publisher_name','TEXT'],['publisher_url','TEXT'],['summary_basis','TEXT'],['translation_state',"TEXT NOT NULL DEFAULT 'queued'"],['translation_error','TEXT'],['translation_started','TEXT'],['publication_kind',"TEXT NOT NULL DEFAULT 'article'"]])if(!db.prepare('PRAGMA table_info(articles)').all().some(c=>c.name===name))db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${definition}`);
  for(const [name,definition] of [['policy_json','TEXT'],['enabled','INTEGER NOT NULL DEFAULT 1']])if(!db.prepare('PRAGMA table_info(sources)').all().some(c=>c.name===name))db.exec(`ALTER TABLE sources ADD COLUMN ${name} ${definition}`);
  db.exec('CREATE TABLE IF NOT EXISTS headline_cache(hash TEXT PRIMARY KEY,original TEXT NOT NULL,title_pl TEXT NOT NULL,created_at TEXT NOT NULL)');
  // Retain old translated text for history, but permanently stop pending translations.
  db.exec("UPDATE articles SET translation_state='disabled',translation_error=NULL,translation_started=NULL WHERE translation_state!='disabled' OR translation_error IS NOT NULL OR translation_started IS NOT NULL");
  retireArticleSummaries(db);
  initInsights(db);
  for(const name of ['event_kind','source_url'])if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name===name))db.exec(`ALTER TABLE events ADD COLUMN ${name} TEXT`);
  for(const [name,type] of [['date_precision',"TEXT NOT NULL DEFAULT 'day'"],['event_end_date','TEXT']])if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name===name))db.exec(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
  db.exec("UPDATE events SET review_status='approved' WHERE review_status='pending'");
  if(!db.prepare('PRAGMA table_info(instruments)').all().some(c=>c.name==='official_url'))db.exec('ALTER TABLE instruments ADD COLUMN official_url TEXT');
  const add = db.prepare('INSERT OR IGNORE INTO instruments(id,name,type,ticker,group_name,watched) VALUES(?,?,?,?,?,?)');
  for (const i of catalog.items) add.run(i.id, i.name_on_screenshot, i.type, i.ticker_on_screenshot || '', i.working_group, 0);
  for(const i of catalog.items)if(i.official_url)db.prepare('UPDATE instruments SET official_url=? WHERE id=?').run(i.official_url,i.id);
  syncPublicationSources(db);
  db.prepare("UPDATE articles SET publication_kind='press' WHERE source_id IN('nvidia-news','microsoft-news','broadcom-ir') OR source_id LIKE 'press-news-%'").run();
  // Domyślnie nic nie jest obserwowane. Użytkowniczka wybiera zakres w aplikacji.
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const x=fn(); db.exec('COMMIT'); return x; } catch(e) { db.exec('ROLLBACK'); throw e; } }
  return {
    db,
    commentsForInstrument(id){return db.prepare('SELECT * FROM instrument_comments WHERE instrument_id=? ORDER BY created_at DESC,rowid DESC').all(id);},
    addComment(instrumentId,text){
      if(!db.prepare('SELECT id FROM instruments WHERE id=?').get(instrumentId))throw Error('Nieznany podmiot');
      if(typeof text!=='string'||!text.trim()||text.trim().length>5000)throw Error('Komentarz musi mieć od 1 do 5000 znaków');
      const id=randomUUID();db.prepare('INSERT INTO instrument_comments VALUES(?,?,?,?)').run(id,instrumentId,text.trim(),isoNow());return id;
    },
    deleteComment(instrumentId,id){db.prepare('DELETE FROM instrument_comments WHERE instrument_id=? AND id=?').run(instrumentId,id);},
    articlesForInstrument(id){return db.prepare(`SELECT a.*,i.name instrument_name,s.name source_name,(SELECT j.id FROM jobs j WHERE j.article_id=a.id AND j.content_hash=a.content_hash) job_id,(SELECT j.status FROM jobs j WHERE j.article_id=a.id AND j.content_hash=a.content_hash) job_status FROM articles a JOIN instruments i ON i.id=a.instrument_id JOIN sources s ON s.id=a.source_id WHERE a.instrument_id=? AND a.eligible=1 AND a.deleted_at IS NULL AND a.publication_kind!='research' AND (a.published_at IS NULL OR a.published_at<=?) ORDER BY a.starred DESC,a.published_at DESC`).all(id,isoNow());},
    editArticle(id,starred,remove=false){
      if(!db.prepare('SELECT id FROM articles WHERE id=? AND deleted_at IS NULL').get(id))throw Error('Nie znaleziono artykułu');
      if(remove){db.prepare('UPDATE articles SET deleted_at=? WHERE id=?').run(isoNow(),id);db.prepare("UPDATE jobs SET status='failed',error='Artykuł usunięty' WHERE article_id=? AND status IN ('queued','running')").run(id);}
      else {if(typeof starred!=='boolean')throw Error('Niepoprawna gwiazdka');db.prepare('UPDATE articles SET starred=? WHERE id=?').run(starred?1:0,id);}
    },
    ingest(source, item) {
      const hash = digest(item.title+'\n'+item.excerpt), now = isoNow();
      return transaction(() => {
        const old = db.prepare('SELECT * FROM articles WHERE instrument_id=? AND url=?').get(source.instrument_id,item.url);
        if(old&&!old.deleted_at&&item.eligible===1)db.prepare('UPDATE articles SET eligible=1,publisher_name=?,publisher_url=?,publication_kind=?,source_id=? WHERE id=?').run(item.publisher_name||null,item.publisher_url||null,item.publication_kind||'article',source.id,old.id);
        if (old?.deleted_at || old?.content_hash === hash) return {id:old.id, changed:false};
        const id=old?.id || randomUUID();
        if (old) {
          db.prepare('INSERT INTO revisions(article_id,content_hash,title,excerpt,recorded_at) VALUES(?,?,?,?,?)').run(id,old.content_hash,old.title,old.excerpt,now);
          db.prepare("UPDATE jobs SET status='superseded',finished_at=? WHERE article_id=? AND status IN ('queued','running')").run(now,id);
          db.prepare("UPDATE events SET review_status='outdated' WHERE article_id=? AND review_status!='rejected'").run(id);
          db.prepare("UPDATE articles SET title=?,excerpt=?,published_at=?,updated_at=?,category=?,content_hash=?,content_status=NULL,content_checked_at=NULL,content_text=NULL,content_url=NULL,title_pl=NULL,summary=NULL,summary_basis=NULL,significance=NULL,ai_at=NULL,read_at=NULL,translation_state='disabled',translation_error=NULL,translation_started=NULL WHERE id=?")
            .run(item.title,item.excerpt,item.published_at,now,item.category,hash,id);
        } else db.prepare("INSERT INTO articles(id,instrument_id,source_id,title,url,excerpt,published_at,discovered_at,updated_at,category,content_hash,translation_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,'disabled')")
          .run(id,source.instrument_id,source.id,item.title,item.url,item.excerpt,item.published_at,now,now,item.category,hash);
        if(item.eligible===1)db.prepare('UPDATE articles SET eligible=1,publisher_name=?,publisher_url=?,publication_kind=? WHERE id=?').run(item.publisher_name||null,item.publisher_url||null,item.publication_kind||'article',id);
        return {id,changed:true};
      });
    },
    enqueue(id) {
      const a=db.prepare('SELECT * FROM articles WHERE id=? AND deleted_at IS NULL').get(id);
      if (!a) throw new Error('Brak wiadomości');
      db.prepare("INSERT OR IGNORE INTO jobs(id,article_id,content_hash,status,created_at,user_requested) VALUES(?,?,?,'queued',?,1)").run(randomUUID(),id,a.content_hash,isoNow());
      return db.prepare('SELECT id,status FROM jobs WHERE article_id=? AND content_hash=?').get(id,a.content_hash);
    },
    claim(limit) {
      return transaction(() => {
        // Przerwane zadania NIE są automatycznie ponawiane i nie zużywają następnych wywołań.
        db.prepare("UPDATE jobs SET status='failed',error='Przekroczono czas wykonania; wymagane ręczne ponowienie',finished_at=? WHERE status='running' AND lease_until < ?").run(isoNow(),isoNow());
        const used=db.prepare('SELECT COUNT(*) n FROM runs WHERE started_at >= ?').get(utcDay()).n;
        if(used >= limit) return {job:null,reason:'daily_limit'};
        const j=db.prepare("SELECT j.*,a.instrument_id,a.title,a.excerpt,a.url,a.published_at,a.publisher_name,a.publisher_url,a.eligible,a.content_status,a.content_checked_at,a.content_text,a.content_url,i.name instrument_name FROM jobs j JOIN articles a ON a.id=j.article_id JOIN instruments i ON i.id=a.instrument_id WHERE j.status='queued' AND j.user_requested=1 AND a.deleted_at IS NULL AND j.content_hash=a.content_hash ORDER BY j.created_at LIMIT 1").get();
        if(!j) return {job:null,reason:'empty'};
        const lease=randomUUID();
        db.prepare("UPDATE jobs SET status='running',lease=?,started_at=?,lease_until=? WHERE id=?").run(lease,isoNow(),new Date(Date.now()+15*60e3).toISOString(),j.id);
        db.prepare('INSERT INTO runs(id,job_id,started_at) VALUES(?,?,?)').run(randomUUID(),j.id,isoNow());
        return {job:{...j,lease}};
      });
    },
    finish(id, lease, value, error, evidenceText='') {
      return transaction(() => {
        const j=db.prepare("SELECT * FROM jobs WHERE id=? AND lease=? AND status='running'").get(id,lease);
        if(!j || j.lease_until < isoNow()) throw new Error('Zadanie wygasło lub zostało zastąpione');
        if(error) {db.prepare("UPDATE jobs SET status='failed',error=?,finished_at=? WHERE id=?").run(String(error).slice(0,300),isoNow(),id); return;}
        const a=db.prepare('SELECT * FROM articles WHERE id=?').get(j.article_id);
        if(a.content_hash!==j.content_hash) throw new Error('Treść źródła zmieniła się');
        validateSummary(value,{...a,excerpt:a.excerpt+' '+evidenceText});
        db.prepare('UPDATE articles SET summary=?,significance=?,category=?,ai_at=? WHERE id=?').run(value.summary,value.significance,value.category,isoNow(),a.id);
        for(const e of value.events) db.prepare("INSERT INTO events(id,article_id,title,event_date,certainty,evidence,created_at,review_status) VALUES(?,?,?,?,?,?,?,'approved')").run(randomUUID(),a.id,e.title,e.date,e.certainty,e.evidence,isoNow());
        db.prepare("UPDATE jobs SET status='done',finished_at=? WHERE id=?").run(isoNow(),id);
      });
    },
    lock(name,ms) {return transaction(()=>{
      const row=db.prepare('SELECT until_at FROM locks WHERE id=?').get(name);
      if(row && row.until_at>Date.now()) return false;
      db.prepare('INSERT OR REPLACE INTO locks(id,until_at) VALUES(?,?)').run(name,Date.now()+ms); return true;
    });},
    unlock(name) {db.prepare('DELETE FROM locks WHERE id=?').run(name);}
  };
}
export function openStore() {
  const catalog=JSON.parse(readFileSync(resolve(root,'catalog.json'),'utf8'));
  return createStore(resolve(process.env.DATA_DIR || resolve(root,'data'), 'sygnal.sqlite'),catalog);
}
