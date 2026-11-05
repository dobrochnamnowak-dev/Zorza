import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {collect} from '../lib/collector.mjs';
import {collectCalendarDates} from '../lib/calendar-fetch.mjs';
import {saveSettings} from '../lib/settings.mjs';
import {collectIssuerCalendar} from '../lib/issuer-calendar.mjs';

const ids=['AKCJA-001','AKCJA-002','AKCJA-003'];
function fixture(t){
 const store=createStore(':memory:',{items:ids.map((id,n)=>({id,name_on_screenshot:['NVIDIA','Microsoft','Broadcom'][n],type:'stock',working_group:'test'}))});
 t.after(()=>store.db.close());return store;
}
const emptyRss=()=>new Response('<rss><channel></channel></rss>');
function reportInstruments(store,report){return [...new Set(report.sources.map(s=>store.db.prepare('SELECT instrument_id FROM sources WHERE id=?').get(s.id).instrument_id))].sort();}

test('pusty zakres nie pobiera nic nawet przy ustawieniu wszystkie i force',async t=>{
 const s=fixture(t);saveSettings(s.db,{scope:'all'});let calls=0;
 const report=await collect(s,{force:true,instrumentIds:ids,fetcher:async()=>{calls++;return emptyRss();}});
 assert.equal(calls,0);assert.deepEqual(report.sources,[]);
});

test('publikacje tylko dla obserwowanych lub portfela; dodanie i usunięcie zmienia zakres',async t=>{
 const s=fixture(t);saveSettings(s.db,{scope:'all'});
 s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[0]);
 s.db.prepare("INSERT INTO purchases VALUES('p',?,1,10,'USD','2026-11-04','2026-11-04')").run(ids[1]);
 const fetcher=async()=>emptyRss();
 assert.deepEqual(reportInstruments(s,await collect(s,{force:true,instrumentIds:ids,fetcher})),ids.slice(0,2));
 s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[2]);
 s.db.prepare('UPDATE sources SET last_checked=NULL').run();
 assert.deepEqual(reportInstruments(s,await collect(s,{force:true,fetcher})),ids);
 s.db.prepare('UPDATE instruments SET watched=0').run();
 s.db.prepare('UPDATE sources SET last_checked=NULL').run();
 assert.deepEqual(reportInstruments(s,await collect(s,{force:true,fetcher})),[ids[1]]);
 s.db.prepare('DELETE FROM purchases').run();let calls=0;
 await collect(s,{force:true,fetcher:async()=>{calls++;return emptyRss();}});assert.equal(calls,0);
});

test('jawna lista identyfikatorów może tylko zawęzić osobisty zakres',async t=>{
 const s=fixture(t);s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[0]);let calls=0;
 const report=await collect(s,{force:true,instrumentIds:[ids[2]],fetcher:async()=>{calls++;return emptyRss();}});
 assert.equal(calls,0);assert.deepEqual(report.sources,[]);
});

test('usunięcie z obserwowanych podczas pobierania blokuje zapis odpowiedzi',async t=>{
 const s=fixture(t);s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[0]);
 const report=await collect(s,{force:true,fetcher:async()=>{
  s.db.prepare('UPDATE instruments SET watched=0').run();
  return new Response(`<rss><channel><item><title>NVIDIA announces new product</title><link>https://nvidianews.nvidia.com/scope-test</link><pubDate>${new Date().toUTCString()}</pubDate><description>New product.</description></item></channel></rss>`);
 }});
 assert.equal(report.added,0);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM articles').get().n,0);
 assert.ok(report.sources.every(s=>s.status==='untracked'));
});

test('terminy ze starych publikacji są sprawdzane tylko w osobistym zakresie',async t=>{
 const s=fixture(t);s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[0]);
 s.db.prepare("INSERT INTO purchases VALUES('p',?,1,10,'USD','2026-11-04','2026-11-04')").run(ids[1]);
 for(const id of ids){
  const source=s.db.prepare('SELECT * FROM sources WHERE instrument_id=? LIMIT 1').get(id);
  s.ingest(source,{title:'Company will report financial results on November 20, 2026',excerpt:'Upcoming financial results.',url:`https://example.com/${id}`,published_at:'2026-11-04T08:00:00Z',category:'wyniki',eligible:1,publication_kind:'article'});
 }
 const report=await collectCalendarDates(s,{instrumentIds:ids,now:new Date('2026-11-04T12:00:00Z'),fetcher:()=>{throw Error('Nie powinno być żądania');}});
 assert.equal(report.pages,0);assert.equal(report.dates,2);
 assert.deepEqual(s.db.prepare('SELECT DISTINCT a.instrument_id FROM events e JOIN articles a ON a.id=e.article_id ORDER BY a.instrument_id').all().map(a=>a.instrument_id),ids.slice(0,2));
});

test('po usunięciu gwiazdki odczyt emitenta nie zapisuje terminów ani nie otwiera następnych stron',async t=>{
 const s=fixture(t);s.db.prepare('UPDATE instruments SET watched=1 WHERE id=?').run(ids[0]);let calls=0;
 await collectIssuerCalendar(s,{now:new Date('2026-11-04T12:00:00Z'),fetcher:async()=>{
  calls++;s.db.prepare('UPDATE instruments SET watched=0').run();
  return new Response('<a href="/events">Events</a><script type="application/ld+json">'+JSON.stringify({'@type':'Event',name:'NVIDIA financial results',startDate:'2026-11-20'})+'</script>');
 }});
 assert.equal(calls,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM events').get().n,0);
 assert.equal(s.db.prepare('SELECT COUNT(*) n FROM articles').get().n,0);
});
