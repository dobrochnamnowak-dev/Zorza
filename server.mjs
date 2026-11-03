import {researchArticle} from './lib/article-research.mjs';
import {collectCalendarDates} from './lib/calendar-fetch.mjs';
import {deploymentRequest} from './lib/deployment.mjs';
import {createPriceHistoryService} from './lib/price-history.mjs';
import {processPublicationWork,headlineStatus} from './lib/publication-work.mjs';
import {spawn} from 'node:child_process';
import {collectQuotes} from './lib/quotes.mjs';
import { getSettings, saveSettings, publicationSlot, priceSlot } from './lib/settings.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { openStore } from './lib/store.mjs';
import { collect } from './lib/collector.mjs';
import { digest, isoNow, utcDay, publicationSince } from './lib/core.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const dev=process.env.DEV_MODE==='1' && process.env.NODE_ENV!=='production';
const port=Number(process.env.PORT)||4173;
const origin=dev?`http://127.0.0.1:${port}`:process.env.APP_ORIGIN;
if(!dev && (!origin?.startsWith('https://') || !process.env.APP_PASSWORD_HASH ||
    !process.env.WORKER_TOKEN || process.env.WORKER_TOKEN.length<32 || !process.env.DATA_DIR?.startsWith('/'))) {
  throw new Error('Produkcja wymaga APP_ORIGIN=https://..., APP_PASSWORD_HASH, WORKER_TOKEN (min. 32 znaki) i absolutnego DATA_DIR.');
}
if(!dev && resolve(process.env.DATA_DIR).startsWith(root+'/')) throw new Error('DATA_DIR musi być poza katalogiem wdrożenia.');
const store=openStore();
const priceHistory=createPriceHistoryService(store);
const aiLimit=300;
const attempts=new Map();
let collectionRunning=false,pricesRunning=false,datesRunning=false;
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function body(req,limit=64000){let size=0,s='';for await(const c of req){size+=c.length;if(size>limit)fail('Żądanie jest za duże',413);s+=c;}try{return JSON.parse(s||'{}');}catch{fail('Niepoprawny JSON');}}
function authenticated(req){
  if(dev) return true;
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sygnal='))?.slice(7);
  return token && store.db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?').get(digest(token),Date.now());
}
function cookie(res,token,age){res.setHeader('Set-Cookie',`sygnal=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${dev?'':'; Secure'}`);}
function snapshot(){
  const since=publicationSince(),now=isoNow();
  const showAll=getSettings(store.db).scope==='all';
  const instruments=store.db.prepare('SELECT i.*,SUM(CASE WHEN s.enabled=1 THEN 1 ELSE 0 END) source_count,(SELECT COUNT(*) FROM articles a WHERE a.instrument_id=i.id AND a.eligible=1 AND a.deleted_at IS NULL AND a.read_at IS NULL AND a.published_at>=? AND a.published_at<=?) unread_count FROM instruments i LEFT JOIN sources s ON s.instrument_id=i.id GROUP BY i.id ORDER BY i.type DESC,i.name').all(since,now);
  const sources=store.db.prepare('SELECT s.id,s.instrument_id,s.name,s.home,s.last_checked,s.last_success,s.error,i.watched,(SELECT MAX(published_at) FROM articles WHERE source_id=s.id) newest_publication FROM sources s JOIN instruments i ON i.id=s.instrument_id WHERE s.enabled=1').all();
  const articles=store.db.prepare(`SELECT a.*,i.name instrument_name,COALESCE(NULLIF(a.publisher_name,''),s.name) source_name,(i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)) is_personal,
    (SELECT j.status FROM jobs j WHERE j.article_id=a.id AND j.content_hash=a.content_hash) job_status
    FROM articles a JOIN instruments i ON i.id=a.instrument_id JOIN sources s ON s.id=a.source_id
    WHERE a.eligible=1 AND a.deleted_at IS NULL AND (a.published_at IS NULL OR a.published_at<=?) ORDER BY a.starred DESC,a.published_at DESC`).all(now).map(a=>({...a,title_pl:a.is_personal?a.title_pl:null}));
  const events=store.db.prepare(`SELECT e.*,COALESCE(e.source_url,a.url) url,a.title source_title,i.name instrument_name FROM events e
    JOIN articles a ON a.id=e.article_id JOIN instruments i ON i.id=a.instrument_id
    WHERE (${showAll?'1=1':'i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)'}) AND a.eligible=1 AND a.deleted_at IS NULL AND e.review_status IN ('pending','approved') ORDER BY e.event_date`).all();
  const jobs=store.db.prepare('SELECT id,article_id,status,created_at,error FROM jobs ORDER BY created_at DESC LIMIT 100').all();
  const used=store.db.prepare('SELECT COUNT(*) n FROM runs WHERE started_at>=?').get(utcDay()).n;
  const worker=store.db.prepare("SELECT value FROM meta WHERE key='worker_seen'").get()?.value || null;
  return {settings:getSettings(store.db),instruments,sources,articles,events,jobs,purchases:store.db.prepare('SELECT * FROM purchases ORDER BY purchased_on DESC,created_at DESC').all(),quotes:store.db.prepare('SELECT * FROM quotes').all(),status:{dev,collectionRunning,aiAuto:false,aiLimit,aiUsed:used,workerSeen:worker,summaryWorkerConfigured:!!process.env.CHAT_BRIDGE_URL,summaryWorkerActive:!!process.env.CHAT_BRIDGE_URL,headlines:headlineStatus(store.db),
    publicationSince:since,schedulerEnabled:process.env.SCHEDULER_ENABLED==='1',lastScheduled:store.db.prepare("SELECT value FROM meta WHERE key='publication_slot'").get()?.value||null,pricesConnected:store.db.prepare('SELECT COUNT(*) n FROM quotes').get().n>0,pricesRunning,pricesTimezone:'Europe/Warsaw',usOpenRefresh:false,usOpenTime:null,priceSchedule:['15:40','21:45'],publicationSchedule:['15:40'],calendarSchedule:['15:40'],lastUSOpenSlot:store.db.prepare("SELECT value FROM meta WHERE key='us_open_slot'").get()?.value||null,calendarReport:JSON.parse(store.db.prepare("SELECT value FROM meta WHERE key='calendar_report'").get()?.value||'null'),pricesDailyHour:15,pricesDailyMinute:40,lastPricesSlot:store.db.prepare("SELECT value FROM meta WHERE key='prices_slot'").get()?.value||null,quotesReport:JSON.parse(store.db.prepare("SELECT value FROM meta WHERE key='quotes_report'").get()?.value||'null'),pushConnected:false,collectionInterval:Math.max(15,Number(process.env.COLLECT_INTERVAL_MINUTES)||360),serverTime:isoNow()}};
}
const assets={'/price-chart.js':'price-chart.js','/portfolio.js':'portfolio.js','/aurora-photo.jpg':'aurora-photo.jpg','/':'index.html','/app.js':'app.js','/style.css':'style.css','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/apple-touch-icon.png':'apple-touch-icon.png'};
const types={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg'};
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(!dev)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
    const path=new URL(req.url,'http://internal').pathname;
    const method=req.method;
    if(dev && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail('Podgląd dostępny wyłącznie lokalnie',403);
    if(dev && req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`) fail('Nieznany adres podglądu',403);
    if(path==='/health') return json(res,200,{ok:true});
    if(path.startsWith('/api/worker/')){
      if(!process.env.WORKER_TOKEN || !equal(req.headers.authorization,`Bearer ${process.env.WORKER_TOKEN}`)) fail('Brak uprawnień procesu',401);
      if(method!=='POST') fail('Niedozwolona metoda',405);
      store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('worker_seen',?)").run(isoNow());
      if(path==='/api/worker/claim')return json(res,200,store.claim(aiLimit));
      if(path==='/api/worker/finish'){
        const b=await body(req);store.finish(b.id,b.lease,b.result,b.error);return json(res,200,{ok:true});
      }
      if(path==='/api/worker/collect'){
        if(collectionRunning)return json(res,202,{busy:true});
        collectionRunning=true;
        collect(store).catch(()=>{}).finally(()=>{collectionRunning=false;});
        return json(res,202,{started:true});
      }
      fail('Nieznana operacja',404);
    }
    if(path.startsWith('/api/')){
      if(method!=='GET' && req.headers.origin!==origin && !(dev&&req.headers.origin===`http://localhost:${port}`)) fail('Niedozwolone źródło żądania',403);
      if(path==='/api/session'&&method==='GET')return json(res,200,{authenticated:!!authenticated(req),dev});
      if(path==='/api/login'&&method==='POST'){
        const key=req.socket.remoteAddress,now=Date.now();
        if(attempts.size>1000)attempts.clear();
        let rate=attempts.get(key);if(!rate||rate.until<now)rate={n:0,until:now+15*60e3};
        if(rate.n>=8)fail('Za dużo prób. Spróbuj ponownie za 15 minut.',429);
        rate.n++;attempts.set(key,rate);
        const b=await body(req),[salt,hash]=(process.env.APP_PASSWORD_HASH||'').split(':');
        if(typeof b.password!=='string'||b.password.length>200||!salt||!hash||!equal(scryptSync(b.password,salt,32).toString('hex'),hash))fail('Nieprawidłowe hasło',401);
        attempts.delete(key);const token=randomBytes(32).toString('hex');
        store.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
        store.db.prepare('INSERT INTO sessions(token_hash,expires) VALUES(?,?)').run(digest(token),now+7*864e5);
        cookie(res,token,7*86400);return json(res,200,{ok:true});
      }
      if(!authenticated(req))fail('Zaloguj się',401);
      if(path==='/api/price-history'&&method==='GET'){
        const params=new URL(req.url,'http://internal').searchParams;
        return json(res,200,await priceHistory.load(params.get('id'),params.get('period')||'1d'));
      }
      if(path.startsWith('/api/deployment/')){
        const action=path.slice('/api/deployment/'.length);
        if(!['status','prepare','deploy'].includes(action)||(action==='status'?method!=='GET':method!=='POST'))fail('Nieznana operacja',404);
        const input=method==='POST'?await body(req):{};
        if(action!=='status'){
          if(collectionRunning||pricesRunning||datesRunning)fail('Trwa aktualizacja danych. Spróbuj za chwilę.',409);
          if(process.env.CHAT_BRIDGE_URL){const chat=await bridgeRequest('/publication/status',{});if(chat.busy)fail('Poczekaj, aż Codex zakończy pracę.',409);}
        }
        return json(res,200,await deploymentRequest(action,input));
      }
      if(path==='/api/logout'&&method==='POST'){
        const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sygnal='))?.slice(7);
        if(token)store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
        cookie(res,'',0);return json(res,200,{ok:true});
      }
      if(path.startsWith('/api/chat/')){
        const action=path.slice('/api/chat/'.length);
        if(!['status','login','message','stop'].includes(action)||(action==='status'?method!=='GET':method!=='POST'))fail('Nieznana operacja',404);
        if(!process.env.CHAT_BRIDGE_URL||!process.env.CHAT_BRIDGE_TOKEN)return json(res,200,{connected:false,messages:[],error:'Połączenie z Codexem w przygotowaniu'});
        const input=method==='POST'?await body(req,action==='message'?4500000:64000):{};
        const upstream=await fetch(new URL('/'+action,process.env.CHAT_BRIDGE_URL),{method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),headers:{Authorization:'Bearer '+process.env.CHAT_BRIDGE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(input)});
        return json(res,upstream.status,{...await upstream.json(),connected:true});
      }
      if(path==='/api/prices'&&method==='POST'){
        if(pricesRunning)return json(res,202,{running:true});
        const last=store.db.prepare("SELECT value FROM meta WHERE key='quotes_report'").get();
        if(last&&Date.now()-Date.parse(JSON.parse(last.value).checked_at)<15*60000)return json(res,200,{recent:true});
        pricesRunning=true;collectQuotes(store).catch(()=>{}).finally(()=>{pricesRunning=false;});return json(res,202,{running:true});
      }
      if(path==='/api/instrument-articles'&&method==='GET'){const id=new URL(req.url,'http://internal').searchParams.get('id');if(!store.db.prepare('SELECT id FROM instruments WHERE id=?').get(id))fail('Nieznany podmiot',404);const i=store.db.prepare('SELECT watched,(SELECT COUNT(*) FROM purchases WHERE instrument_id=?) bought FROM instruments WHERE id=?').get(id,id);return json(res,200,{articles:store.articlesForInstrument(id).map(a=>({...a,is_personal:!!(i.watched||i.bought),title_pl:i.watched||i.bought?a.title_pl:null,source_name:a.publisher_name||a.source_name}))});}
      if(path==='/api/dashboard'&&method==='GET')return json(res,200,snapshot());
      if(path==='/api/settings'&&method==='POST'){return json(res,200,{settings:saveSettings(store.db,await body(req))});}
      if(path==='/api/purchase'&&method==='POST'){
        const b=await body(req);
        if(!store.db.prepare('SELECT id FROM instruments WHERE id=?').get(b.instrument_id)||typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<=0||b.quantity>1e12||typeof b.price!=='number'||!Number.isFinite(b.price)||b.price<0||b.price>1e12||!['USD','EUR','PLN','GBP','CHF'].includes(b.currency)||!/^\d{4}-\d{2}-\d{2}$/.test(b.purchased_on)||!Number.isFinite(Date.parse(b.purchased_on))||new Date(b.purchased_on).toISOString().slice(0,10)!==b.purchased_on)fail('Sprawdź ilość, cenę, walutę i datę zakupu');
        store.db.exec('BEGIN IMMEDIATE');try{
          store.db.prepare('INSERT INTO purchases VALUES(?,?,?,?,?,?,?)').run(randomUUID(),b.instrument_id,b.quantity,b.price,b.currency,b.purchased_on,isoNow());
          store.db.exec('COMMIT');
        }catch(e){store.db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});
      }
      if(path==='/api/purchase-delete'&&method==='POST'){
        const b=await body(req);store.db.prepare('DELETE FROM purchases WHERE id=?').run(b.id);return json(res,200,{ok:true});
      }
      if(path==='/api/watch'&&method==='POST'){
        const b=await body(req);
        if(typeof b.watched!=='boolean'||!store.db.prepare('SELECT id FROM instruments WHERE id=?').get(b.id))fail('Nieznany instrument');
        store.db.prepare('UPDATE instruments SET watched=? WHERE id=?').run(b.watched?1:0,b.id);
        return json(res,200,{ok:true});
      }
      if(path==='/api/collect'&&method==='POST'){
        if(collectionRunning)return json(res,202,{busy:true});
        collectionRunning=true;
        collect(store,{force:true}).catch(()=>{}).finally(()=>{collectionRunning=false;});
        return json(res,202,{started:true});
      }
      if(path==='/api/article-research'&&method==='POST'){
        const b=await body(req);const article=store.db.prepare('SELECT a.title,a.url,i.name instrument_name FROM articles a JOIN instruments i ON i.id=a.instrument_id WHERE a.id=? AND a.deleted_at IS NULL').get(b.id);if(!article)fail('Nie znaleziono artykułu',404);
        return json(res,200,await researchArticle(article));
      }
      if(path==='/api/article-star'&&method==='POST'){const b=await body(req);store.editArticle(b.id,b.starred);return json(res,200,{ok:true});}
      if(path==='/api/article-delete'&&method==='POST'){const b=await body(req);store.editArticle(b.id,undefined,true);return json(res,200,{ok:true});}
      if(path==='/api/read'&&method==='POST'){
        const b=await body(req);store.db.prepare('UPDATE articles SET read_at=? WHERE id=?').run(isoNow(),b.id);return json(res,200,{ok:true});
      }
      if(path==='/api/title-retry'&&method==='POST'){
        const b=await body(req);store.db.prepare("UPDATE articles SET translation_state='queued',translation_error=NULL WHERE id=? AND eligible=1 AND deleted_at IS NULL AND translation_state='failed' AND instrument_id IN(SELECT i.id FROM instruments i WHERE i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))").run(b.id);publicationWork().catch(()=>{});return json(res,200,{ok:true});
      }
      if(path==='/api/summarize'&&method==='POST'){
        const b=await body(req);if(!store.db.prepare('SELECT id FROM articles WHERE id=? AND eligible=1 AND deleted_at IS NULL').get(b.id))fail('Źródło publikacji wymaga weryfikacji',404);const result=store.enqueue(b.id);publicationWork().catch(()=>{});return json(res,200,result);
      }
      if(path==='/api/retry'&&method==='POST'){
        const b=await body(req);
        store.db.prepare("UPDATE jobs SET status='queued',error=NULL,lease=NULL,user_requested=1 WHERE id=? AND status='failed' AND content_hash=(SELECT content_hash FROM articles WHERE id=jobs.article_id)").run(b.id);
        return json(res,200,{ok:true});
      }
      if(path==='/api/event-review'&&method==='POST'){
        const b=await body(req);if(!['approved','rejected'].includes(b.status))fail('Nieprawidłowy status');
        store.db.prepare("UPDATE events SET review_status=? WHERE id=? AND review_status='pending'").run(b.status,b.id);return json(res,200,{ok:true});
      }
      fail('Nieznana operacja',404);
    }
    if(method!=='GET')fail('Niedozwolona metoda',405);
    const file=assets[path]||(/^\/logos\/(AKCJA|ETF)-\d{3}\.png$/.test(path)?path.slice(1):null);if(!file||!existsSync(resolve(root,'public',file)))fail('Nie znaleziono strony',404);
    res.writeHead(200,{'Content-Type':(types[file.split('.').pop()]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-cache'});
    res.end(readFileSync(resolve(root,'public',file)));
  }catch(e){json(res,e.status||400,{error:e.status?e.message:'Nie udało się wykonać operacji. Sprawdź dane lub status zadania.'});}
});
server.requestTimeout=30000;
server.listen(port,dev?'127.0.0.1':'0.0.0.0',()=>console.log(`Sygnał: ${origin}${dev?' (podgląd lokalny)':''}`));
async function scheduledTick(){
 if(process.env.SCHEDULER_ENABLED!=='1'||collectionRunning)return;
 const slot=publicationSlot(getSettings(store.db).publicationsFrequency);
 if(!slot||store.db.prepare("SELECT value FROM meta WHERE key='publication_slot'").get()?.value===slot)return;
 if(!store.lock('daily-schedule',10*60e3))return;
 collectionRunning=true;
 try{await collect(store,{force:true});store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('publication_slot',?)").run(slot);}
 finally{collectionRunning=false;store.unlock('daily-schedule');}
}
async function scheduledPrices(){
 if(process.env.SCHEDULER_ENABLED!=='1'||pricesRunning)return;
 const slot=priceSlot(getSettings(store.db).pricesFrequency);
 if(!slot||store.db.prepare("SELECT value FROM meta WHERE key='prices_slot'").get()?.value===slot)return;
 pricesRunning=true;
 try{const result=await collectQuotes(store);if(!result.busy)store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('prices_slot',?)").run(slot);}finally{pricesRunning=false;}
}
async function scheduledCalendar(){
 if(process.env.SCHEDULER_ENABLED!=='1'||collectionRunning||datesRunning)return;
 const slot=publicationSlot('daily');if(!slot||store.db.prepare("SELECT value FROM meta WHERE key='calendar_slot'").get()?.value===slot)return;
 datesRunning=true;try{const r=await collectCalendarDates(store);if(!r.busy)store.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('calendar_slot',?)").run(slot);}finally{datesRunning=false;}
}
const scheduleTimer=setInterval(()=>{scheduledTick().catch(()=>{});scheduledPrices().catch(()=>{});scheduledCalendar().catch(()=>{});},60000);scheduleTimer.unref();
scheduledTick().catch(()=>{});scheduledPrices().catch(()=>{});scheduledCalendar().catch(()=>{});
// Stały proces podsumowań uruchamiany razem z serwerem po jawnym włączeniu.
let workRunning=false,workStopping=false;
async function bridgeRequest(path,task){
 const r=await fetch(new URL(path,process.env.CHAT_BRIDGE_URL),{method:'POST',redirect:'error',signal:AbortSignal.timeout(170000),headers:{Authorization:'Bearer '+process.env.CHAT_BRIDGE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(task||{})});
 if(!r.ok)throw Error('Codex: nie można zakończyć opracowania (HTTP '+r.status+')');return r.json();
}
async function publicationWork(){
 if(workRunning||workStopping||!process.env.CHAT_BRIDGE_URL||!process.env.CHAT_BRIDGE_TOKEN)return;
 workRunning=true;try{return await processPublicationWork(store,{available:async()=>{try{const s=await bridgeRequest('/publication/status');return !!s.ready&&!!s.authenticated&&!s.busy;}catch{return false;}},runModel:task=>bridgeRequest('/publication',task)});}finally{workRunning=false;}
}
const workerTimer=setInterval(()=>publicationWork().catch(()=>{}),20000);workerTimer.unref();
server.once('listening',()=>publicationWork().catch(()=>{}));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{workStopping=true;clearInterval(workerTimer);clearInterval(scheduleTimer);server.close(()=>{store.db.close();process.exit(0);});});
