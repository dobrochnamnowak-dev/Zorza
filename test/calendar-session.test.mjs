import test from 'node:test';
import assert from 'node:assert/strict';
import {usOpenSlot} from '../lib/us-session.mjs';
import {extractEventDates,saveEventDates} from '../lib/event-extraction.mjs';
import {createStore} from '../lib/store.mjs';
import {collectQuotes} from '../lib/quotes.mjs';
const now=new Date('2026-11-03T10:00:00Z');
test('odświeżenie po otwarciu USA używa czasu Nowego Jorku, obu zmian czasu i dni sesyjnych',()=>{
 assert.equal(usOpenSlot(new Date('2026-11-03T14:34:59Z')),null);
 assert.equal(usOpenSlot(new Date('2026-11-03T14:35:00Z')),'2026-11-03/09:35-NY');
 assert.equal(usOpenSlot(new Date('2026-10-26T13:35:00Z')),'2026-10-26/09:35-NY');
 assert.equal(usOpenSlot(new Date('2026-03-09T13:35:00Z')),'2026-03-09/09:35-NY');
 assert.equal(usOpenSlot(new Date('2026-07-06T13:35:00Z')),'2026-07-06/09:35-NY');
 for(const day of ['2026-11-07','2026-11-26','2026-07-03','2026-04-03'])assert.equal(usOpenSlot(new Date(day+'T14:35:00Z')),null);
 assert.equal(usOpenSlot(new Date('2026-12-24T18:00:00Z')),null);
 assert.equal(usOpenSlot(new Date('2027-12-31T14:35:00Z')),'2027-12-31/09:35-NY');
});
test('zapowiedziane wyniki i sprawozdania trafiają do kalendarza bez podsumowania AI',()=>{
 const a={title:'NVIDIA to announce quarterly financial results on November 18, 2026',excerpt:'',published_at:'2026-11-03T09:00:00Z',publication_kind:'press'};
 const result=extractEventDates(a,now);assert.equal(result.length,1);assert.equal(result[0].date,'2026-11-18');assert.equal(result[0].certainty,'confirmed');
 assert.equal(extractEventDates({...a,title:'NVIDIA to report earnings on November 18'},now)[0].certainty,'estimated');
 assert.equal(extractEventDates({...a,title:'Company will publish its annual report on 12 December 2026'},now)[0].kind,'report');
 assert.equal(extractEventDates({...a,title:'The fund will pay its distribution on November 20, 2026'},now)[0].kind,'distribution');
 assert.equal(extractEventDates({...a,title:'NVIDIA reported results for the quarter ended September 30, 2026'},now).length,0);
 const dateline=extractEventDates({...a,title:'Company to report quarterly results',excerpt:'SANTA CLARA, Nov 3, 2026 -- The company will report earnings on November 18, 2026.'},now);assert.deepEqual(dateline.map(e=>e.date),['2026-11-18']);
 const meeting=extractEventDates({...a,title:'Company announces earnings and also schedules an investor meeting on December 10, 2026'},now);assert.equal(meeting[0].kind,'meeting');
});
test('ta sama zapowiedź nie dubluje kalendarza, a potwierdzony rok ma pierwszeństwo',()=>{
 const s=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'półprzewodniki'}]});
 try{for(const [n,title] of ['NVIDIA to announce financial results on November 18','NVIDIA to announce financial results on November 18, 2026'].entries()){
 const item={title,excerpt:'',published_at:'2026-11-03T09:00:00Z',publication_kind:'press',eligible:1,url:'https://nvidianews.nvidia.com/'+n,category:'wyniki'};const {id}=s.ingest({id:'nvidia-news',instrument_id:'AKCJA-001'},item);saveEventDates(s,{...item,id,instrument_id:'AKCJA-001'},now);
 }assert.equal(s.db.prepare('SELECT COUNT(*) n FROM events').get().n,1);assert.equal(s.db.prepare('SELECT certainty FROM events').get().certainty,'confirmed');assert.equal(s.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 }finally{s.db.close();}
});
test('pobranie wybranych cen nie odpytuje pozostałych i nie nadpisuje raportu całej listy',async()=>{
 const s=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'technologia'},{id:'AKCJA-002',name_on_screenshot:'Microsoft',type:'stock',working_group:'technologia'}]});
 try{s.db.prepare("INSERT INTO meta(key,value) VALUES('quotes_report',?)").run('{"configured":137}');let calls=0;const report=await collectQuotes(s,{instrumentIds:['AKCJA-001'],reportKey:'quotes_focus_report',fetcher:async url=>{calls++;assert.ok(url.includes('/NVDA?'));return new Response(JSON.stringify({chart:{result:[{meta:{symbol:'NVDA',currency:'USD',instrumentType:'EQUITY',regularMarketPrice:110,chartPreviousClose:100,regularMarketTime:Math.floor(Date.now()/1000)}}]}}));}});
 assert.equal(calls,1);assert.equal(report.configured,1);assert.equal(JSON.parse(s.db.prepare("SELECT value FROM meta WHERE key='quotes_report'").get().value).configured,137);assert.equal(JSON.parse(s.db.prepare("SELECT value FROM meta WHERE key='quotes_focus_report'").get().value).downloaded,1);
 }finally{s.db.close();}
});
