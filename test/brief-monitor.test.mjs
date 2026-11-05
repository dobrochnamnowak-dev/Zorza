import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {sixMonthExpiry,syncBriefMonitors,newBriefArticles,briefEntries} from '../lib/brief-monitor.mjs';
import {queueInsights,processInsightWork} from '../lib/company-insights.mjs';
import {collectIssuerCalendar,issuerLinks,listedIssuerEvents,structuredIssuerEvents} from '../lib/issuer-calendar.mjs';
const start=new Date('2026-11-04T10:00:00Z');
function fixture(t){const s=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'technologia'},{id:'AKCJA-002',name_on_screenshot:'Microsoft',type:'stock',working_group:'technologia'},{id:'ETF-001',name_on_screenshot:'WisdomTree Europe Defence UCITS ETF',type:'etf',working_group:'obronność'}]});t.after(()=>s.db.close());return s;}
function article(s,suffix,date){return s.ingest({id:'foreign-news-akcja-001',instrument_id:'AKCJA-001'},{title:'NVIDIA news '+suffix,excerpt:'Public company information '+suffix,url:'https://www.reuters.com/'+suffix,published_at:date,eligible:1,publisher_name:'Reuters',category:'inne'}).id;}
function answer(task,kind='events'){return {overview:{text:'Opis po polsku.',sources:[task.articles[0].id]},drivers:[],risks:[],events:[],actions:[],deadlines:[],[kind]:[{text:'Nowa informacja '+task.articles[0].title,sources:[task.articles[0].id]}],price_context:'Brak potwierdzonej przyczyny ruchu kursu.',limitations:'Dostępne fragmenty.',material_changed:true};}
test('dodanie gwiazdki lub zakupu włącza tylko właściwy podmiot, usunięcie z obu grup zatrzymuje',t=>{
 const s=fixture(t);assert.deepEqual(syncBriefMonitors(s.db,start),[]);
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();assert.deepEqual(syncBriefMonitors(s.db,start),['AKCJA-001']);assert.deepEqual(syncBriefMonitors(s.db,start),[]);
 assert.equal(s.db.prepare("SELECT needs_check FROM brief_monitors WHERE instrument_id='AKCJA-001'").get().needs_check,1);
 s.db.prepare("INSERT INTO purchases VALUES('p','AKCJA-002',1,1,'USD','2026-11-04','2026-11-04')").run();assert.deepEqual(syncBriefMonitors(s.db,start),['AKCJA-002']);
 s.db.prepare("UPDATE instruments SET watched=0 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,start);assert.equal(s.db.prepare("SELECT active FROM brief_monitors WHERE instrument_id='AKCJA-001'").get().active,0);
 assert.equal(s.db.prepare("SELECT active FROM brief_monitors WHERE instrument_id='AKCJA-002'").get().active,1);
});
test('brak cofania do historii; wygaśnięcie wpisu nie uruchamia modelu',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,start);
 article(s,'old','2026-11-03T12:00:00Z');assert.equal(newBriefArticles(s.db,'AKCJA-001',new Date('2026-11-04T14:00:00Z')).length,0);
 article(s,'first','2026-11-04T12:00:00Z');let calls=0;
 const work=async now=>{queueInsights(s,{now,scope:'personal'});return processInsightWork(s,{now,scope:'personal',runModel:async task=>{calls++;return answer(task);}});};
 await work(new Date('2026-11-04T14:00:00Z'));assert.equal(calls,1);
 await work(new Date('2027-02-04T14:00:00Z'));assert.equal(calls,1);assert.equal(briefEntries(s.db,'AKCJA-001',new Date('2027-02-04T14:00:00Z')).length,1);
 await work(new Date('2027-05-05T14:00:00Z'));assert.equal(calls,1);assert.equal(briefEntries(s.db,'AKCJA-001',new Date('2027-05-05T14:00:00Z')).length,0);
});
test('kolejna aktualizacja przekazuje tylko nowy artykuł i dopisuje punkt, zachowując poprzedni',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,start);
 const first=article(s,'first','2026-11-04T12:00:00Z'),day1=new Date('2026-11-04T14:00:00Z');queueInsights(s,{now:day1,scope:'personal'});
 await processInsightWork(s,{now:day1,scope:'personal',runModel:async task=>answer(task)});
 const second=article(s,'second','2026-11-05T12:00:00Z'),day2=new Date('2026-11-05T14:00:00Z');queueInsights(s,{now:day2,scope:'personal'});
 await processInsightWork(s,{now:day2,scope:'personal',runModel:async task=>{assert.deepEqual(task.articles.map(a=>a.id),[second]);assert.ok(!task.articles.some(a=>a.id===first));assert.equal(task.previous_brief.length,1);return answer(task,'actions');}});
 assert.equal(briefEntries(s.db,'AKCJA-001',day2).length,2);assert.equal(newBriefArticles(s.db,'AKCJA-001',day2).length,0);
});
test('sześć miesięcy kalendarzowych uwzględnia krótszy luty i rok przestępny',()=>{
 assert.equal(sixMonthExpiry('2026-08-31T12:00:00Z'),'2027-02-28T12:00:00.000Z');
 assert.equal(sixMonthExpiry('2027-08-31T12:00:00Z'),'2028-02-29T12:00:00.000Z');
});
test('ponowne obserwowanie nie wznawia dawnych zleceń sprzed nowej aktywacji',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,start);
 article(s,'waiting','2026-11-04T12:00:00Z');queueInsights(s,{now:new Date('2026-11-04T14:00:00Z'),scope:'personal'});
 s.db.prepare("UPDATE instruments SET watched=0 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,new Date('2026-11-04T15:00:00Z'));
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();syncBriefMonitors(s.db,new Date('2026-11-05T10:00:00Z'));
 let calls=0;await processInsightWork(s,{now:new Date('2026-11-05T14:00:00Z'),scope:'personal',runModel:async()=>{calls++;}});assert.equal(calls,0);
});
test('sprawdzanie emitenta jest publiczne, dotyczy tylko wybranych i koryguje termin bez duplikatu',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();let date='2026-11-17',calls=[];
 const fetcher=async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.ok(!options.headers.Authorization);return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Event',name:'NVIDIA quarterly financial results',startDate:date})+'</script>',{headers:{'Content-Type':'text/html'}});};
 await collectIssuerCalendar(s,{now:start,fetcher});assert.equal(calls.length,1);assert.ok(calls[0].includes('nvidia.com'));assert.equal(s.db.prepare('SELECT event_date FROM events').get().event_date,date);
 await collectIssuerCalendar(s,{now:start,fetcher});assert.equal(calls.length,1);
 date='2026-11-18';await collectIssuerCalendar(s,{now:new Date('2026-11-05T10:00:00Z'),fetcher});
 assert.equal(s.db.prepare('SELECT COUNT(*) n FROM events').get().n,1);assert.equal(s.db.prepare('SELECT event_date FROM events').get().event_date,date);
});
test('linki i przekierowania poza emitenta oraz paywall nie są obchodzone',async t=>{
 assert.deepEqual(issuerLinks('<a href="http://nvidia.com/events">events</a><a href="https://evil.test/calendar">calendar</a><a href="/events">Events</a>','https://nvidia.com/',['nvidia.com']),['https://nvidia.com/events']);
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();let calls=0;
 const r=await collectIssuerCalendar(s,{now:start,fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://evil.test/events'}});}});
 assert.equal(calls,1);assert.equal(r.events,0);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM articles').get().n,0);
});
test('kalendarz IR łączy datę i konferencję w jednej karcie, pomija przeszłe, anulowane i błędne daty',()=>{
 const card=(date,name,extra='')=>`<article><time datetime="${date}">${date}</time><h3>${name}</h3>${extra}</article>`;
 const html='<h2>Upcoming Events</h2>'+card('2026-12-01T00:00:00','UBS Global Technology and AI Conference')+card('2026-12-09','Barclays 24th Annual Global Technology Conference')+card('2026-02-30','Invalid investor conference')+card('2026-12-10','Cancelled investor conference')+card('2026-12-11','Investor conference','<time datetime="2026-12-12">Other</time>')+'<h2>Past Events</h2>'+card('2026-12-20','Past earnings results');
 assert.deepEqual(listedIssuerEvents(html).map(e=>[e.name,e.date]),[['UBS Global Technology and AI Conference','2026-12-01'],['Barclays 24th Annual Global Technology Conference','2026-12-09']]);
 assert.equal(listedIssuerEvents(card('2026-12-01','Unrelated conference')).length,0);
 assert.equal(structuredIssuerEvents('<script type="application/ld+json">'+JSON.stringify({'@type':'Event',name:'Technology Conference',startDate:'2026-12-01'})+'</script>').length,1);
});
test('terminy AMD trafiają do wspólnego kalendarza bez AI, aktualizacja zachowuje jeden wpis i respektuje odrzucenie',async t=>{
 const s=createStore(':memory:',{items:[{id:'AKCJA-005',name_on_screenshot:'Advanced Micro Devices',type:'stock',working_group:'półprzewodniki'}]});t.after(()=>s.db.close());
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-005'").run();
 let date='2026-12-01',second=true,calls=[];
 const fetcher=async url=>{calls.push(url);return new Response(url.endsWith('/ir-calendar')?'<h2>Upcoming Events</h2>'+`<article><time datetime="${date}T00:00:00">${date}</time><h3>UBS Global Technology and AI Conference</h3><a href="/ical?id=9249">Add to Calendar</a></article>`+(second?'<article><time datetime="2026-12-09T00:00:00">Dec 9</time><h3>Barclays 24th Annual Global Technology Conference</h3><a href="/ical?id=9250">Add to Calendar</a></article>':'')+'<h2>Past Events</h2><article><time datetime="2026-11-03">Nov 3</time><h3>AMD Financial Results</h3></article>':'<p>AMD corporate site</p>');};
 await collectIssuerCalendar(s,{now:start,fetcher});
 assert.equal(calls[0],'https://ir.amd.com/news-events/ir-calendar');
 const read=()=>s.db.prepare("SELECT e.*,a.instrument_id FROM events e JOIN articles a ON a.id=e.article_id WHERE e.review_status='approved' ORDER BY event_date").all();
 assert.deepEqual(read().map(e=>e.event_date),['2026-12-01','2026-12-09']);
 assert.ok(read().every(e=>e.instrument_id==='AKCJA-005'&&e.certainty==='confirmed'&&e.source_url==='https://ir.amd.com/news-events/ir-calendar'&&e.evidence));
 const firstId=read()[0].id;date='2026-12-02';second=false;
 await collectIssuerCalendar(s,{now:new Date('2026-11-05T10:00:00Z'),fetcher});
 assert.equal(read().length,1);assert.equal(read()[0].id,firstId);assert.equal(read()[0].event_date,date);
 s.db.prepare("UPDATE events SET review_status='rejected' WHERE id=?").run(firstId);
 date='2026-12-03';await collectIssuerCalendar(s,{now:new Date('2026-11-06T10:00:00Z'),fetcher});
 assert.equal(read().length,0);assert.equal(s.db.prepare('SELECT review_status FROM events WHERE id=?').get(firstId).review_status,'rejected');
 assert.equal(s.db.prepare('SELECT COUNT(*) n FROM insight_jobs').get().n,0);
});
