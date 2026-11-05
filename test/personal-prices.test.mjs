import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {personalPriceSlot} from '../lib/settings.mjs';
import {collectScheduledPersonalPrices} from '../lib/personal-prices.mjs';
import {insightBody} from '../public/company-insights.js';

test('18:30 jest codziennym polskim terminem, niezależnie od obu zmian czasu',()=>{
 for(const [day,hour] of [['2026-11-04',17],['2026-07-02',16],['2026-03-29',16],['2026-10-25',17],['2026-11-07',17]]){
  assert.equal(personalPriceSlot(new Date(`${day}T${hour}:29:59Z`)),null);
  assert.equal(personalPriceSlot(new Date(`${day}T${hour}:30:00Z`)),day+'/18:30');
 }
});
test('dodatkowe pobranie obejmuje sumę obserwowanych i zakupów, raz na dzień, bez zmiany raportu całej listy',async t=>{
 const s=createStore(':memory:',{items:[1,2,3].map(n=>({id:'AKCJA-00'+n,name_on_screenshot:'Test '+n,type:'stock',working_group:'test'}))});t.after(()=>s.db.close());
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 s.db.prepare("INSERT INTO purchases VALUES('p','AKCJA-002',1,1,'USD','2026-11-04','2026-11-04')").run();
 s.db.prepare("INSERT INTO meta VALUES('quotes_report',?)").run('{"configured":140}');
 const calls=[],now=new Date('2026-11-04T17:30:00Z');
 const fetcher=async url=>{calls.push(url);const symbol=url.includes('/NVDA?')?'NVDA':'MSFT';return new Response(JSON.stringify({chart:{result:[{meta:{symbol,currency:'USD',instrumentType:'EQUITY',regularMarketPrice:110,chartPreviousClose:100,regularMarketTime:Math.floor(Date.now()/1000)}}]}}));};
 assert.equal((await collectScheduledPersonalPrices(s,{now:new Date('2026-11-04T17:29:59Z'),fetcher})).status,'not_due');assert.equal(calls.length,0);
 s.lock('quotes',60000);assert.equal((await collectScheduledPersonalPrices(s,{now,fetcher})).status,'busy');s.unlock('quotes');
 assert.equal(s.db.prepare("SELECT value FROM meta WHERE key='personal_prices_slot'").get(),undefined);
 const first=await collectScheduledPersonalPrices(s,{now,fetcher});assert.equal(first.status,'done');assert.equal(calls.length,2);assert.ok(calls.some(u=>u.includes('/NVDA?')));assert.ok(calls.some(u=>u.includes('/MSFT?')));
 assert.equal((await collectScheduledPersonalPrices(s,{now:new Date('2026-11-04T20:00:00Z'),fetcher})).status,'not_due');assert.equal(calls.length,2);
 assert.deepEqual(s.db.prepare('SELECT instrument_id FROM quotes ORDER BY instrument_id').all().map(x=>x.instrument_id),['AKCJA-001','AKCJA-002']);
 assert.equal(JSON.parse(s.db.prepare("SELECT value FROM meta WHERE key='quotes_report'").get().value).configured,140);
 assert.equal(JSON.parse(s.db.prepare("SELECT value FROM meta WHERE key='quotes_focus_report'").get().value).downloaded,2);
 assert.equal(s.db.prepare("SELECT value FROM meta WHERE key='personal_prices_slot'").get().value,'2026-11-04/18:30');
 s.db.prepare("UPDATE instruments SET watched=0 WHERE id='AKCJA-001'").run();
 await collectScheduledPersonalPrices(s,{now:new Date('2026-11-05T17:30:00Z'),fetcher});assert.equal(calls.length,3);assert.ok(calls[2].includes('/MSFT?'));
 assert.equal(s.db.prepare('SELECT COUNT(*) n FROM insight_jobs').get().n,0);
});
test('pusta grupa nie pobiera kursów; data sprawdzenia źródeł nie zastępuje daty opracowania',async t=>{
 const s=createStore(':memory:',{items:[]});t.after(()=>s.db.close());
 assert.equal((await collectScheduledPersonalPrices(s,{now:new Date('2026-11-04T17:30:00Z'),fetcher:async()=>{throw Error('Unexpected network');}})).status,'empty');
 const html=insightBody({id:'i',personal:true},{status:'done',generated_at:'2026-11-03T14:00:00Z',checked_at:'2026-11-04T14:00:00Z',content:{overview:{text:'Opis.',sources:[]},drivers:[],risks:[]}});
 assert.ok(html.includes('Opis zaktualizowano <time datetime="2026-11-03T14:00:00Z"'));
 assert.ok(html.includes('Źródła sprawdzono <time datetime="2026-11-04T14:00:00Z"'));
 assert.ok(html.includes('2026'));
 const empty=insightBody({id:'i',personal:true},{checked_at:'2026-11-04T14:00:00Z'});assert.ok(!empty.includes('Opis zaktualizowano'));
});
