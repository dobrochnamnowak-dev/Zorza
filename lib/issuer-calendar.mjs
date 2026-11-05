import {issuerDomains,issuerCalendarSeeds} from './issuer-sources.mjs';
import {allowedDomain} from './publication-policy.mjs';
import {clean,digest,validDay} from './core.mjs';
import {saveEventDates,extractEventDates} from './event-extraction.mjs';
const topic=/investor|financial|earnings|results|calendar|events|shareholder|stockholder|distribution|dividend|fund.notice|notices|conference|capital.markets/i;
export function issuerLinks(html,url,domains){
 const score=link=>/calendar/i.test(link)?0:/investor|\/ir(?:\/|$)|events/i.test(link)?1:2;
 return [...new Set([...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>topic.test(m[1]+' '+clean(m[2]))).map(m=>{try{return new URL(m[1].replaceAll('&amp;','&'),url).href.split('#')[0];}catch{return '';}}).filter(link=>allowedDomain(link,domains)&&!/[\/](?:past|archive)(?:[\/?]|$)/i.test(link)))].sort((a,b)=>score(a)-score(b)).slice(0,8);
}
function upcomingSection(html){
 const safe=html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const start=/<h[1-6]\b[^>]*>\s*Upcoming\s+Events\s*<\/h[1-6]>/i.exec(safe);
 if(!start)return null;
 return safe.slice(start.index+start[0].length).split(/<h[1-6]\b[^>]*>\s*(?:Past|Previous|Archived)\s+Events\s*<\/h[1-6]>/i)[0];
}
// Match dates and names inside the same event card, never across neighbouring cards.
export function listedIssuerEvents(html){
 const section=upcomingSection(html);if(section===null)return [];
 const found=[];
 for(const m of section.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)){
  const block=m[1];if(/\bcancell?ed\b/i.test(clean(block)))continue;
  const times=[...block.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/gi)];
  const headings=[...block.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi)];
  if(times.length!==1||headings.length!==1)continue;
  const date=times[0][1].slice(0,10),name=clean(headings[0][1]);
  if(!validDay(date)||!name||name.length>180||!topic.test(name))continue;
  const key=block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Add to Calendar\s*<\/a>/i)?.[1]?.replaceAll('&amp;','&');
  found.push({name,date,...(key?{key}:{}),url:null});
 }
 return found.slice(0,20);
}
export function structuredIssuerEvents(html){
 const found=[];
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const stack=[JSON.parse(m[1])];while(stack.length){const x=stack.pop();if(Array.isArray(x)){stack.push(...x);continue;}if(!x||typeof x!=='object')continue;
   if(x['@graph'])stack.push(x['@graph']);if(x.itemListElement)stack.push(x.itemListElement);if(x.item)stack.push(x.item);
   if((Array.isArray(x['@type'])?x['@type']: [x['@type']]).some(t=>/Event$/.test(t||''))&&typeof x.name==='string'&&topic.test(x.name)&&typeof x.startDate==='string'&&validDay(x.startDate.slice(0,10))&&!/EventCancelled/.test(x.eventStatus||''))found.push({name:clean(x.name).slice(0,180),date:x.startDate.slice(0,10),url:typeof x.url==='string'?x.url:null});
  }}catch{}
 }
 return found.slice(0,20);
}
async function publicPage(url,domains,fetcher){
 for(let hop=0;hop<3;hop++){
  if(!allowedDomain(url,domains))throw Error('Strona poza zweryfikowaną domeną emitenta');
  const r=await fetcher(url,{redirect:'manual',headers:{Accept:'text/html','User-Agent':'ZorzaPersonalCalendar/1.0'},signal:AbortSignal.timeout(15000)});
  if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url).href;if(!allowedDomain(next,domains))throw Error('Przekierowanie poza domenę emitenta');url=next;continue;}
  if(!r.ok)throw Error('Publiczna strona zwróciła HTTP '+r.status);
  if(Number(r.headers.get('content-length')||0)>2e6)throw Error('Strona przekracza limit');
  let bytes=0;const chunks=[];for await(const chunk of r.body){bytes+=chunk.length;if(bytes>2e6)throw Error('Strona przekracza limit');chunks.push(chunk);}
  const html=Buffer.concat(chunks).toString('utf8');if(/"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test(html))throw Error('Treść nie jest ogólnodostępna');
  return {url,html};
 }
 throw Error('Zbyt wiele przekierowań');
}
export async function collectIssuerCalendar(store,{now=new Date(),fetcher=fetch,instrumentIds=null,force=false}={}){
 if(!store.lock('issuer-calendar',5*60000))return {busy:true};
 const db=store.db,day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(now),report={checked_at:now.toISOString(),pages:0,events:0,instruments:[]},shared=new Map();
 try{
  const tracked=db.prepare('SELECT 1 FROM instruments i WHERE id=? AND (watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))');
  const selected=db.prepare('SELECT i.* FROM instruments i WHERE watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)').all().filter(i=>!instrumentIds||instrumentIds.includes(i.id)).sort((a,b)=>(db.prepare('SELECT value FROM meta WHERE key=?').get('issuer-last/'+a.id)?.value||'').localeCompare(db.prepare('SELECT value FROM meta WHERE key=?').get('issuer-last/'+b.id)?.value||''));
  const deadline=Date.now()+3*60000;
  let next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<selected.length&&Date.now()<deadline){const i=selected[next++];
   if(!tracked.get(i.id))continue;
   const key='issuer-calendar/'+day+'/'+i.id;if(!force&&db.prepare('SELECT 1 FROM meta WHERE key=?').get(key))continue;
   db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key,'checked');
   db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run('issuer-last/'+i.id,now.toISOString());
   const domains=issuerDomains(i);if(!domains.length){report.instruments.push({id:i.id,status:'unverified'});continue;}
   const queue=[...issuerCalendarSeeds(i),i.official_url||'https://'+domains[0]+'/'].filter(url=>allowedDomain(url,domains)),seen=new Set();let errors=0,events=0;
   while(queue.length&&seen.size<3&&Date.now()<deadline){
    if(!tracked.get(i.id))break;
    const target=queue.shift();if(seen.has(target))continue;seen.add(target);
    try{
     if(!shared.has(target))shared.set(target,publicPage(target,domains,fetcher));
     const page=await shared.get(target);report.pages++;
     if(!tracked.get(i.id))break;
     queue.push(...issuerLinks(page.html,page.url,domains).filter(url=>!seen.has(url)));
     // Generic issuer dates must never be attributed to every ETF from that issuer.
     if(i.type==='etf'&&(!i.official_url||new URL(page.url).pathname==='/'||!page.html.toLowerCase().includes(i.name.toLowerCase())))continue;
     const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(now);
     const until=Date.parse(today)+400*86400000,unique=new Map();
     for(const e of [...structuredIssuerEvents(page.html),...listedIssuerEvents(page.html)])if(e.date>=today&&Date.parse(e.date)<=until)unique.set(e.name+'|'+e.date,e);
     const section=upcomingSection(page.html),emptyCalendar=section!==null&&(!clean(section)||/\bno upcoming events\b/i.test(clean(section)));
     const structured=[...unique.values()].slice(0,20),preciseCalendar=structured.length>0||emptyCalendar;
     const text=clean(page.html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,''));
     if(!preciseCalendar&&!topic.test(text))continue;
     if(!preciseCalendar&&!extractEventDates({title:i.name,excerpt:text,publication_kind:'press'},now).length)continue;
     const source={id:'issuer-calendar-'+i.id.toLowerCase(),instrument_id:i.id};
     db.prepare('INSERT INTO sources(id,instrument_id,name,url,home,enabled) VALUES(?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET url=excluded.url,home=excluded.home').run(source.id,i.id,'Kalendarz emitenta',page.url,new URL(page.url).origin);
     const excerpt=preciseCalendar?JSON.stringify(structured):text.slice(0,14000);
     const item={title:i.name+' — odczyt kalendarza emitenta',url:page.url,excerpt:'Odczyt strony, nie data publikacji: '+excerpt,published_at:now.toISOString(),eligible:1,publication_kind:'calendar',publisher_name:i.name,publisher_url:new URL(page.url).origin,category:'działania'};
     const {id}=store.ingest(source,item);
     if(!preciseCalendar){events+=saveEventDates(store,{...item,id,instrument_id:i.id,source_url:page.url},now);continue;}
     for(const e of structured){
      const kind=/dividend|distribution/i.test(e.name)?'distribution':/earnings|results|financial/i.test(e.name)?'earnings':'meeting';
      const eventId='issuer-'+digest(i.id+'|'+page.url+'|'+(e.key||e.name));
      const evidence=e.name+' · '+e.date;
      db.prepare(`INSERT INTO events(id,article_id,title,event_date,certainty,evidence,review_status,created_at,event_kind,source_url) VALUES(?,?,?,?,'confirmed',?,'approved',?,?,?) ON CONFLICT(id) DO UPDATE SET article_id=excluded.article_id,title=excluded.title,event_date=excluded.event_date,evidence=excluded.evidence,source_url=excluded.source_url,review_status=CASE WHEN events.review_status='rejected' THEN 'rejected' ELSE 'approved' END`).run(eventId,id,e.name,e.date,evidence,now.toISOString(),kind,page.url);events++;
     }
    }catch{errors++;}
   }
   report.events+=events;report.instruments.push({id:i.id,status:errors?'partial':'checked',events});
  }}));
  report.unchecked=selected.length-next;
  db.prepare("INSERT OR REPLACE INTO meta VALUES('issuer_calendar_report',?)").run(JSON.stringify(report));return report;
 }finally{store.unlock('issuer-calendar');}
}
