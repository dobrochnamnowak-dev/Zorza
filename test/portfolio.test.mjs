import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyChange,portfolioOverview} from '../public/portfolio.js';
import {mergeQuotes} from '../public/portfolio.js';
const quotes=[{instrument_id:'a',price:110,change_percent:10,currency:'USD',as_of:'2026-11-02T15:00:00Z'},{instrument_id:'b',price:80,change_percent:-20,currency:'EUR',as_of:'2026-11-02T15:00:00Z'},{instrument_id:'c',price:140,change_percent:40,currency:'USD',as_of:'2026-10-30T15:00:00Z'}];
test('spóźniony dashboard nie cofa nowszych kursów otrzymanych w profilu',()=>{
 const latest={...quotes[0],price:120,as_of:'2026-11-04T14:40:00Z'};
 const merged=mergeQuotes([latest],quotes);assert.equal(merged.find(q=>q.instrument_id==='a').price,120);
 assert.equal(merged.length,3);assert.deepEqual(mergeQuotes(quotes,[latest]).find(q=>q.instrument_id==='a'),latest);
});
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
test('wynik portfela uwzględnia wszystkie zakupy i pełny koszt, niezależnie od dziennej zmiany',async()=>{
 const {portfolioPerformance}=await import('../public/portfolio.js');const items=[{id:'a'}],buys=[{instrument_id:'a',quantity:.25,price:200,currency:'USD'},{instrument_id:'a',quantity:.5,price:100,currency:'USD'}];
 const [result]=portfolioPerformance(items,buys,[{instrument_id:'a',price:220,currency:'USD',as_of:'2026-11-03T12:00:00Z',change_percent:-5}]);assert.equal(result.cost,100);assert.equal(result.value,165);assert.equal(result.profit,65);assert.equal(result.percent,65);assert.ok(result.complete);
});
test('waluty są oddzielne, a brak notowania nie jest traktowany jako cena zero',async()=>{
 const {portfolioPerformance}=await import('../public/portfolio.js');const items=[{id:'a'},{id:'b'},{id:'c'}];const buys=[{instrument_id:'a',quantity:1,price:100,currency:'USD'},{instrument_id:'b',quantity:1,price:50,currency:'USD'},{instrument_id:'c',quantity:2,price:10,currency:'EUR'}];const quotes=[{instrument_id:'a',price:90,currency:'USD',as_of:'2026-11-03T12:00:00Z'},{instrument_id:'b',price:60,currency:'EUR',as_of:'2026-11-03T12:00:00Z'},{instrument_id:'c',price:12,currency:'EUR',as_of:'2026-11-03T12:00:00Z'}];const [usd,eur]=portfolioPerformance(items,buys,quotes);
 assert.equal(usd.profit,-10);assert.equal(usd.cost,150);assert.equal(usd.pricedCost,100);assert.equal(usd.complete,false);assert.deepEqual(usd.missing,['b']);assert.equal(eur.profit,4);assert.ok(eur.complete);assert.equal(portfolioPerformance(items,buys,[])[0].value,null);assert.equal(portfolioPerformance(items,buys,[])[0].profit,null);
});
