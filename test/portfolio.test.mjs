import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyChange,portfolioOverview} from '../public/portfolio.js';
const quotes=[{instrument_id:'a',price:110,change_percent:10,currency:'USD',as_of:'2026-11-02T15:00:00Z'},{instrument_id:'b',price:80,change_percent:-20,currency:'EUR',as_of:'2026-11-02T15:00:00Z'},{instrument_id:'c',price:140,change_percent:40,currency:'USD',as_of:'2026-10-30T15:00:00Z'}];
test('zmiana kwotowa dotyczy poprzedniego zamknięcia, nie ceny zakupu',()=>{
 assert.ok(Math.abs(dailyChange(quotes[0]).change_amount-10)<1e-9);
 assert.ok(Math.abs(dailyChange(quotes[1]).change_amount+20)<1e-9);
 assert.equal(dailyChange({...quotes[0],change_percent:null}),null);
 assert.equal(dailyChange({...quotes[0],change_percent:-100}),null);
});
test('TOP 3 porównuje wzrosty i spadki całej listy z jednego dnia',()=>{
 const items=['a','b','c','d'].map(id=>({id,name:id}));
 const buys=['a','a','b','c'].map(instrument_id=>({instrument_id,quantity:.5}));
 const result=portfolioOverview(items,buys,[...quotes,{...quotes[0],instrument_id:'d',change_percent:90}]);
 assert.equal(result.owned.length,3);assert.equal(result.owned.find(i=>i.id==='a').quantity,1);
 assert.deepEqual(result.movers.map(i=>i.id),['d','b','a']);assert.equal(result.asOf,'2026-11-02');
 assert.deepEqual(portfolioOverview(items,[],quotes).movers.map(i=>i.id),['b','a']);
 assert.deepEqual(portfolioOverview(items,[],[...quotes,{...quotes[0],instrument_id:'outside',change_percent:100}]).movers.map(i=>i.id),['b','a']);
});
test('rankingi rozdzielają typy, kierunki i daty oraz pomijają obce instrumenty',async()=>{
 const {marketLeaders}=await import('../public/portfolio.js');
 const items=['a','b','c','d','e','f','g','h'].map(id=>({id,name:id,type:id==='h'?'etf':'stock'}));
 const changes={a:10,b:-20,c:90,d:0,e:8,f:7,g:6,h:-2};
 const input=Object.entries(changes).map(([id,change_percent])=>({...quotes[0],instrument_id:id,change_percent,as_of:id==='c'?'2026-10-30T15:00:00Z':id==='h'?'2026-10-31T15:00:00Z':quotes[0].as_of}));
 const [stocks,etfs]=marketLeaders(items,[...input,{...quotes[0],instrument_id:'outside',change_percent:100}]);
 assert.deepEqual(stocks.gains.map(i=>i.id),['a','e','f']);
 assert.deepEqual(stocks.losses.map(i=>i.id),['b']);
 assert.equal(stocks.count,6);assert.equal(stocks.total,7);
 assert.deepEqual(etfs.gains,[]);assert.deepEqual(etfs.losses.map(i=>i.id),['h']);
 assert.equal(etfs.asOf,'2026-10-31');
 assert.ok(marketLeaders(items,[]).every(g=>g.count===0&&g.gains.length===0&&g.losses.length===0));
});
test('sortowanie cen i zmian działa w obu kierunkach, a braki zawsze są na końcu',async()=>{
 const {sortAssets}=await import('../public/portfolio.js');const items=['a','b','c','d'].map(id=>({id,name:id}));const q=[{instrument_id:'a',price:20,change_percent:-5},{instrument_id:'b',price:10,change_percent:8},{instrument_id:'c',price:null,change_percent:null}];
 assert.deepEqual(sortAssets(items,q,'price','asc').map(i=>i.id),['b','a','c','d']);assert.deepEqual(sortAssets(items,q,'price','desc').map(i=>i.id),['a','b','c','d']);assert.deepEqual(sortAssets(items,q,'change','desc').map(i=>i.id),['b','a','c','d']);assert.deepEqual(sortAssets(items,q,'change','asc').map(i=>i.id),['a','b','c','d']);assert.deepEqual(items.map(i=>i.id),['a','b','c','d']);
});
test('import zakupów zachowuje pełny koszt i odrzuca błędne dane przed zapisem',async()=>{
 const {purchaseImport,samePurchase}=await import('../public/portfolio.js');const items=[{id:'test'}];const payload={instrument_id:'test',currency:'USD',transactions:[{quantity:.25,price:200,total_paid:50,purchased_on:'2026-10-30'}]};const [record]=purchaseImport(payload,items);assert.equal(record.quantity*record.price,50);assert.ok(samePurchase(record,{...record,id:'saved'}));assert.ok(!samePurchase(record,{...record,quantity:1}));assert.throws(()=>purchaseImport({...payload,transactions:[{...payload.transactions[0],total_paid:60}]},items));assert.throws(()=>purchaseImport(payload,[]));assert.throws(()=>purchaseImport({...payload,transactions:[{...payload.transactions[0],purchased_on:'2026-02-30'}]},items));
});
