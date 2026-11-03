import {titlesSchema,noteSchema,publicationPrompt} from '../scripts/publication-ai.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {generatedSources,acceptPublication,syncPublicationSources,publicationProfile} from '../lib/publication-policy.mjs';
import {processPublicationWork,headlineStatus} from '../lib/publication-work.mjs';
import {extractArticleText} from '../lib/article-text.mjs';
import {selectPublications} from '../public/portfolio.js';

const catalog={items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'półprzewodniki'},{id:'AKCJA-002',name_on_screenshot:'Microsoft',type:'stock',working_group:'technologia'},{id:'AKCJA-005',name_on_screenshot:'Advanced Micro Devices',type:'stock',working_group:'półprzewodniki'}]};
function add(store,id,title='Nvidia announces new GPU',suffix=id){const source={id:'foreign-news-'+id.toLowerCase(),instrument_id:id};return store.ingest(source,{title,excerpt:'A new product was announced by the company.',url:'https://www.reuters.com/technology/'+suffix,published_at:new Date(Date.now()-3600000).toISOString(),category:'działania',eligible:1,publisher_name:'Reuters',publisher_url:'https://www.reuters.com'}).id;}
test('zagraniczny wydawca i właściwy podmiot są sprawdzane niezależnie',()=>{
 const s=generatedSources(catalog.items[0]).find(s=>s.policy.kind==='search');const source={...s,policy_json:JSON.stringify(s.policy)};
 const item={title:'Nvidia announces new GPU - Reuters',excerpt:'Nvidia news',url:'https://news.google.com/rss/articles/abc',publisher_url:'https://www.reuters.com',publisher_name:'Reuters'};
 assert.equal(acceptPublication(source,item).publisher_name,'Reuters');
 assert.equal(acceptPublication(source,{...item,publisher_url:'https://example.pl'}),null);
 assert.equal(acceptPublication(source,{...item,publisher_url:'https://reuters.com.evil.test'}),null);
 assert.equal(acceptPublication(source,{...item,title:'Microsoft expands a data centre',excerpt:''}),null);
 assert.equal(acceptPublication(source,{...item,title:'Nvidia ogłosiła wyniki'}),null);
});
test('nowy podmiot dostaje automatycznie źródła odpowiadające branży',()=>{
 const store=createStore(':memory:',catalog);try{store.db.prepare('INSERT INTO instruments(id,name,type,ticker,group_name) VALUES(?,?,?,?,?)').run('NEW','Example Bank','stock','EXB','bankowość');syncPublicationSources(store.db);
 const row=store.db.prepare("SELECT * FROM sources WHERE instrument_id='NEW' AND id LIKE 'foreign-news-%'").get();const p=JSON.parse(row.policy_json);assert.equal(p.sector,'finance');assert.ok(p.domains.includes('bankingdive.com'));const u=new URL(row.url);assert.equal(u.searchParams.get('hl'),'en-US');assert.ok(u.searchParams.get('q').includes('site:finextra.com'));
 assert.equal(publicationProfile({name:'Example Pharma',type:'stock',group_name:'biofarmaceutyka'}).sector,'health');
 }finally{store.db.close();}
});
test('tłumaczenie obejmuje tylko obserwowane i portfel, a cache zapobiega ponownemu AI',async()=>{
 const store=createStore(':memory:',catalog);try{store.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();store.db.prepare('INSERT INTO purchases VALUES(?,?,?,?,?,?,?)').run('p','AKCJA-002',1,10,'USD','2026-11-03','2026-11-03');
 const n=add(store,'AKCJA-001'),m=add(store,'AKCJA-002','Microsoft expands cloud'),other=add(store,'AKCJA-005','AMD launches a product');let calls=0;
 const runModel=async task=>{calls++;assert.equal(task.kind,'titles');return {items:task.items.map(i=>({id:i.id,title_pl:'Polski nagłówek: '+i.title}))};};
 assert.equal((await processPublicationWork(store,{runModel})).count,2);assert.ok(store.db.prepare('SELECT title_pl FROM articles WHERE id=?').get(n).title_pl);assert.ok(store.db.prepare('SELECT title_pl FROM articles WHERE id=?').get(m).title_pl);assert.equal(store.db.prepare('SELECT title_pl FROM articles WHERE id=?').get(other).title_pl,null);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 assert.equal((await processPublicationWork(store,{runModel})).status,'empty');assert.equal(calls,1);
 add(store,'AKCJA-002','Nvidia announces new GPU','duplicate-cache');await processPublicationWork(store,{runModel});assert.equal(calls,1);assert.equal(headlineStatus(store.db).used,2);store.db.prepare("UPDATE articles SET title_pl=NULL,translation_state='failed' WHERE id=?").run(n);await processPublicationWork(store,{runModel});assert.equal(calls,1);assert.ok(store.db.prepare('SELECT title_pl FROM articles WHERE id=?').get(n).title_pl);
 }finally{store.db.close();}
});
test('podsumowanie jest wykonywane dopiero po zamówieniu, a powtórne kliknięcie nie tworzy drugiego zadania',async()=>{
 const store=createStore(':memory:',catalog);try{const id=add(store,'AKCJA-001');let calls=0;const runModel=async task=>{calls++;assert.equal(task.kind,'summary');return {title_pl:'Nvidia ogłasza nowy procesor',summary:'Spółka zapowiedziała nowy produkt. Dostępny jest tylko nagłówek i krótki fragment.',significance:'Brak dalszych szczegółów.',category:'działania',events:[]};};
 assert.equal((await processPublicationWork(store,{runModel})).status,'empty');assert.equal(calls,0);store.enqueue(id);store.enqueue(id);await processPublicationWork(store,{runModel,fetcher:async()=>{throw Error('Unavailable');}});assert.equal(calls,1);assert.equal(store.db.prepare('SELECT status FROM jobs').get().status,'done');assert.ok(store.db.prepare('SELECT summary FROM articles WHERE id=?').get(id).summary);await processPublicationWork(store,{runModel});assert.equal(calls,1);
 }finally{store.db.close();}
});
test('dni prasówki są rozłączne w polskiej strefie czasu, a archiwum zachowuje starsze materiały',()=>{
 const articles=['2026-11-03','2026-11-02','2026-11-01','2026-10-31'].map((d,i)=>({id:String(i),published_at:d+'T12:00:00Z'}));const now='2026-11-03T22:30:00Z';
 for(const [view,id] of [['today','0'],['yesterday','1'],['before_yesterday','2'],['archive','3']])assert.deepEqual(selectPublications(articles,{view,now}).map(a=>a.id),[id]);
});
test('ekstrakcja treści nie obchodzi paywalla i nie wykonuje HTML',()=>{
 assert.equal(extractArticleText('<script type="application/ld+json">{"articleBody":"Sample body"}</script>'),'Sample body');
 assert.equal(extractArticleText('<script type="application/ld+json">{"articleBody":"Hidden","isAccessibleForFree":false}</script>'),'');
});
test('limit 100 nowych nagłówków jest trwały, a kolejka nie tworzy automatycznych podsumowań',async()=>{
 const store=createStore(':memory:',catalog);try{store.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();for(let n=0;n<101;n++)add(store,'AKCJA-001','Nvidia news '+n,'budget-'+n);let calls=0;
 const runModel=async task=>{calls++;return {items:task.items.map(i=>({id:i.id,title_pl:'Wiadomość po polsku'}))};};
 for(let n=0;n<5;n++)await processPublicationWork(store,{runModel});assert.equal(calls,5);assert.equal(headlineStatus(store.db).used,100);assert.equal((await processPublicationWork(store,{runModel})).status,'daily_limit');assert.equal(calls,5);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 }finally{store.db.close();}
});

test('moduł modelu ładuje oba schematy i rozdziela tłumaczenie od streszczania',()=>{assert.ok(titlesSchema.properties.items);assert.ok(noteSchema.properties.events);const p=publicationPrompt({kind:'titles',items:[{id:'1',title:'Nvidia news'}]});assert.ok(p.includes('Bez streszczania'));});
test('komunikaty własnego emitenta są oddzielone od artykułów portali i wymagają jego domeny',()=>{
 const sources=generatedSources(catalog.items[0]),source=sources.find(s=>s.policy.kind==='press_search');assert.ok(source);assert.ok(source.policy.domains.includes('nvidia.com'));
 const item={title:'NVIDIA Announces Results',url:'https://news.google.com/rss/articles/release',publisher_url:'https://nvidianews.nvidia.com',publisher_name:'NVIDIA'};const accepted=acceptPublication({...source,policy_json:JSON.stringify(source.policy)},item);assert.equal(accepted.publication_kind,'press');assert.equal(acceptPublication({...source,policy_json:JSON.stringify(source.policy)},{...item,publisher_url:'https://reuters.com'}),null);
 const articles=[{id:'p',published_at:'2026-11-03T12:00:00Z',publication_kind:'press',category:'wyniki'},{id:'a',published_at:'2026-11-03T12:00:00Z',publication_kind:'article',category:'wyniki'}];assert.deepEqual(selectPublications(articles,{category:'komunikaty',now:'2026-11-03T18:00:00Z'}).map(a=>a.id),['p']);
 const etf=generatedSources({id:'ETF-001',name:'WisdomTree Europe Defence UCITS ETF',type:'etf',group_name:'obronność'}).find(s=>s.policy.kind==='press_search');assert.ok(etf.policy.domains.includes('wisdomtree.eu'));
});
test('przerwany proces nie zostawia podsumowania na zawsze w stanie pracy i nie ponawia modelu',async()=>{
 const store=createStore(':memory:',catalog);try{const id=add(store,'AKCJA-001');store.enqueue(id);store.claim(300);store.db.prepare("UPDATE jobs SET lease_until='2020-01-01'").run();let calls=0;await processPublicationWork(store,{runModel:async()=>{calls++;}});assert.equal(store.db.prepare('SELECT status FROM jobs').get().status,'failed');assert.equal(calls,0);}finally{store.db.close();}
});
