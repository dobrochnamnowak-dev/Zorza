import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore} from '../lib/store.mjs';
const catalog=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url),'utf8'));
test('katalog obejmuje nowe zdjęcia, odrębne warianty i nie powiela istniejących akcji',()=>{
 assert.equal(catalog.items.length,154);
 assert.equal(new Set(catalog.items.map(i=>i.id)).size,154);
 for(const name of ['Applied Materials','Oracle','Mastercard'])assert.equal(catalog.items.filter(i=>i.name_on_screenshot===name).length,1);
 for(const ticker of ['PM','GE','INTC','SHEL','AMAT','HSBC','PANW','MS','AZN','SAP','RHO','RHO5','PG','MRK','ORCL','UNH','BAC','HD','NVS','NOT','ASME','MA','ABBV','COST','CVX','PLTR','KO','CSCO','NVDA','AAPL','MSFT','GOOGL','GOOG','AMZN','TSM','TSLA','AVGO','META','LLY','SPCX','WMT','MU','JPM','BRK.B','SKHY','AMD','XOM','V','JNJ','ASML','TTWO','KTOS','GLND'])assert.ok(catalog.items.some(i=>i.ticker_on_screenshot===ticker),ticker);
 assert.equal(catalog.items.filter(i=>i.type==='stock').length,108);
 assert.equal(catalog.items.find(i=>i.ticker_on_screenshot==='SPCX').working_group,'do weryfikacji instrumentu');
 assert.equal(catalog.items.filter(i=>i.type==='etf').length,46);
});
test('nowy katalog ładuje się do pustej bazy bez fikcyjnych notowań',()=>{
 const store=createStore(':memory:',catalog);
 try{assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM instruments').get().n,154);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n,0);}finally{store.db.close();}
});

test('lista ze zdjęć polecanych aktywów zawiera każdy podmiot dokładnie raz',()=>{
 for(const name of ["NVIDIA","Microsoft","Broadcom","Micron Technology","Advanced Micro Devices","Oracle","Applied Materials","Arista Networks","Marvell Technology","Seagate Technology","Western Digital","Veeva Systems","Humana","Nu Holdings","Teradyne","Ciena Corporation","Coherent Corporation","Pure Storage","Flextronics International","Affirm Holdings"])assert.equal(catalog.items.filter(i=>i.type==='stock'&&i.name_on_screenshot===name).length,1,name);
});

test('podmioty z listy obserwowanych na zdjęciach nie są powielone',()=>{for(const name of ['Meta Platforms','Alphabet (Class A)','NVIDIA','Intel','Broadcom','Ciena Corporation','Western Digital','Marvell Technology','Applied Materials','AeroVironment'])assert.equal(catalog.items.filter(i=>i.name_on_screenshot===name).length,1,name);assert.equal(catalog.items.find(i=>i.name_on_screenshot==='AeroVironment').ticker_on_screenshot,'AVAV');});
