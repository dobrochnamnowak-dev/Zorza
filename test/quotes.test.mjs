import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuote,fetchQuotes,collectQuotes} from '../lib/quotes.mjs';
import {readFileSync} from 'node:fs';
import {createStore} from '../lib/store.mjs';
const mapping={instrument_id:'AKCJA-001',symbol:'NVDA',currency:'USD'};
const now=Date.parse('2026-11-02T18:00:00Z');
const payload=(extra={})=>({chart:{result:[{meta:{symbol:'NVDA',currency:'USD',instrumentType:'EQUITY',regularMarketPrice:110,chartPreviousClose:100,regularMarketTime:now/1000,...extra}}]}});
test('cena i zmiana odnoszą się do poprzedniego zamknięcia z datą źródła',()=>{
 const q=parseQuote(payload(),mapping,now);assert.equal(q.price,110);assert.ok(Math.abs(q.change_percent-10)<1e-9);assert.equal(q.as_of,new Date(now).toISOString());
 assert.ok(parseQuote(payload({regularMarketPrice:90}),mapping,now).change_percent<0);
});
test('ETF musi mieć potwierdzoną nazwę, walutę i giełdę; zbieżny ticker nie wystarcza',()=>{
 const etf={...mapping,instrumentType:'ETF',verified_name:'Fund A',exchange:'GER'};
 assert.equal(parseQuote(payload({instrumentType:'ETF',longName:'Fund A',exchangeName:'GER'}),etf,now).price,110);
 assert.throws(()=>parseQuote(payload({instrumentType:'ETF',longName:'Fund B',exchangeName:'GER'}),etf,now));
 assert.throws(()=>parseQuote(payload({instrumentType:'ETF',longName:'Fund A',exchangeName:'LSE'}),etf,now));
});
test('pobieranie używa zakresu jednej sesji, aby chartPreviousClose nie oznaczało początku tygodnia',async()=>{
 const current=payload({regularMarketTime:Math.floor(Date.now()/1000)});
 const report=await fetchQuotes({sources:[mapping],fetcher:async url=>{assert.equal(new URL(url).searchParams.get('range'),'1d');return new Response(JSON.stringify(current));}});
 assert.equal(report.quotes.length,1);assert.ok(Math.abs(report.quotes[0].change_percent-10)<1e-9);
});
test('braki, nieaktualne wartości i niezgodny instrument nie tworzą ceny',()=>{
 for(const extra of [{symbol:'OTHER'},{currency:'EUR'},{instrumentType:'ETF'},{regularMarketPrice:null},{chartPreviousClose:0},{regularMarketTime:now/1000-8*86400},{regularMarketTime:now/1000+3600}])assert.throws(()=>parseQuote(payload(extra),mapping,now));
});
test('blokada źródła zatrzymuje dalsze pobieranie bez obejścia',async()=>{
 let calls=0;const report=await fetchQuotes({fetcher:async()=>{calls++;return new Response('',{status:429});}});assert.ok(report.stopped);assert.equal(report.quotes.length,0);assert.ok(calls<=2);
});
test('nieudane odświeżenie zachowuje prawdziwe wcześniejsze notowanie i zapisuje błąd',async()=>{
 const catalog=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url),'utf8'));const store=createStore(':memory:',catalog);
 try{store.db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?)').run(mapping.instrument_id,100,1,'USD',new Date(now).toISOString(),'poprzednie źródło');await collectQuotes(store,{fetcher:async()=>new Response('',{status:403})});assert.equal(store.db.prepare('SELECT price FROM quotes WHERE instrument_id=?').get(mapping.instrument_id).price,100);const report=JSON.parse(store.db.prepare("SELECT value FROM meta WHERE key='quotes_report'").get().value);assert.ok(report.stopped);assert.ok(report.errors.length);}finally{store.db.close();}
});
