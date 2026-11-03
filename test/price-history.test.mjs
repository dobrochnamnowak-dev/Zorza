import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {parseHistory,createPriceHistoryService} from '../lib/price-history.mjs';
import {chartGeometry} from '../public/price-chart.js';

const mapping={instrument_id:'AKCJA-001',symbol:'NVDA',currency:'USD'};
const now=Date.parse('2026-11-03T15:00:00Z');
const payload=()=>({chart:{result:[{meta:{symbol:'NVDA',currency:'USD',instrumentType:'EQUITY',chartPreviousClose:100},timestamp:[now/1000-600,now/1000-300,now/1000],indicators:{quote:[{close:[101,102,105]}]}}]}});
function fixture(t){const s=createStore(':memory:',{items:[{id:mapping.instrument_id,type:'stock',name_on_screenshot:'NVIDIA',working_group:'Półprzewodniki'}]});t.after(()=>s.db.close());return s;}

test('wykres dzienny liczy zmianę od poprzedniego zamknięcia, dłuższy od pierwszej dostępnej ceny',()=>{
 const day=parseHistory(payload(),mapping,'1d',now),year=parseHistory(payload(),mapping,'1y',now);
 assert.equal(day.baseline,100);assert.equal(day.change,5);assert.ok(Math.abs(day.change_percent-5)<1e-9);
 assert.equal(year.baseline,101);assert.equal(year.change,4);assert.equal(year.points.length,3);
 assert.throws(()=>parseHistory(payload(),{...mapping,symbol:'OTHER'},'1y',now));
 assert.throws(()=>parseHistory(payload(),{...mapping,currency:'EUR'},'1y',now));
 assert.throws(()=>parseHistory(payload(),mapping,'all',now));
});

test('historia nie tworzy cen dla braków, nie używa dywidendowego adjusted close ani przyszłych punktów',()=>{
 const p=payload();p.chart.result[0].timestamp=[now/1000-900,now/1000-600,now/1000-300,now/1000+600];p.chart.result[0].indicators.quote[0].close=[100,null,110,999];p.chart.result[0].indicators.adjclose=[{adjclose:[80,85,90,99]}];
 const h=parseHistory(p,mapping,'5y',now);assert.deepEqual(h.points.map(p=>p.value),[100,null,110]);
 assert.equal(h.first,new Date(now-900000).toISOString());assert.equal(h.last,new Date(now-300000).toISOString());
 assert.throws(()=>parseHistory({chart:{result:[{...p.chart.result[0],timestamp:[now/1000],indicators:{quote:[{close:[100]}]}}]}},mapping,'1d',now),/Za mało/);
});

test('zakresy mają ograniczone zapytania, trwały cache i jeden odczyt przy równoległych wejściach',async t=>{
 const store=fixture(t),calls=[];
 const fetcher=async url=>{calls.push(new URL(url));return new Response(JSON.stringify(payload()));};
 const history=createPriceHistoryService(store,{mappings:[mapping],fetcher,now:()=>now});
 const [a,b]=await Promise.all([history.load(mapping.instrument_id,'1d'),history.load(mapping.instrument_id,'1d')]);assert.deepEqual(a,b);assert.equal(calls.length,1);
 const restarted=createPriceHistoryService(store,{mappings:[mapping],fetcher,now:()=>now+1000});await restarted.load(mapping.instrument_id,'1d');assert.equal(calls.length,1);
 for(const range of ['1w','1y','5y'])await history.load(mapping.instrument_id,range);
 assert.deepEqual(calls.map(u=>[u.searchParams.get('range'),u.searchParams.get('interval')]),[['1d','5m'],['5d','30m'],['1y','1d'],['5y','1wk']]);
 assert.ok(calls.every(u=>u.hostname==='query1.finance.yahoo.com'&&u.searchParams.get('includePrePost')==='false'));
 await assert.rejects(history.load('unknown','1d'),/Nieznany/);await assert.rejects(history.load(mapping.instrument_id,'evil'),/Nieprawidłowy/);assert.equal(calls.length,4);
});

test('blokada źródła nie jest obchodzona; stare dane są oznaczone i pozostają dostępne',async t=>{
 const store=fixture(t);let stamp=now,calls=0,blocked=false;
 const history=createPriceHistoryService(store,{mappings:[mapping],now:()=>stamp,fetcher:async()=>{calls++;return blocked?new Response('blocked',{status:429}):new Response(JSON.stringify(payload()));}});
 await history.load(mapping.instrument_id,'1d');stamp+=16*60000;blocked=true;
 const old=await history.load(mapping.instrument_id,'1d');assert.equal(old.stale,true);assert.equal(old.fetched_at,new Date(now).toISOString());assert.equal(calls,2);
 await assert.rejects(history.load(mapping.instrument_id,'5y'));assert.equal(calls,2);
 const restarted=createPriceHistoryService(store,{mappings:[mapping],now:()=>stamp,fetcher:async()=>{throw Error('nie powinno być wywołane');}});
 await assert.rejects(restarted.load(mapping.instrument_id,'1y'),/wstrzymało/);
});

test('błędny instrument ETF i brak mapowania nie tworzą wykresu',async t=>{
 const store=fixture(t);const history=createPriceHistoryService(store,{mappings:[],fetcher:()=>{throw Error('nie pobieraj');}});
 await assert.rejects(history.load(mapping.instrument_id,'1d'),/Brak potwierdzonego/);
 assert.throws(()=>parseHistory(payload(),{...mapping,instrumentType:'ETF',verified_name:'Fund A'},'1y',now));
});

test('geometria nie łączy brakujących cen, a płaski wykres ma skończone współrzędne',()=>{
 const g=chartGeometry([{time:'a',value:100},{time:'b',value:null},{time:'c',value:100},{time:'d',value:100}]);
 assert.equal((g.path.match(/M/g)||[]).length,2);assert.equal((g.path.match(/L/g)||[]).length,1);assert.ok(!/NaN|Infinity/.test(g.path));assert.equal(g.positions[1],null);
 assert.equal(chartGeometry([{value:100},{value:null}]),null);
});
