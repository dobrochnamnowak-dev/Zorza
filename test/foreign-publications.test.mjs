import {publicationPrompt,runPublicationAI} from '../scripts/publication-ai.mjs';
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
 assert.equal(acceptPublication(source,{...item,title:'Nvidia ogłosiła wyniki'}).title,'Nvidia ogłosiła wyniki');
});
test('nowy podmiot dostaje automatycznie źródła odpowiadające branży',()=>{
 const store=createStore(':memory:',catalog);try{store.db.prepare('INSERT INTO instruments(id,name,type,ticker,group_name) VALUES(?,?,?,?,?)').run('NEW','Example Bank','stock','EXB','bankowość');syncPublicationSources(store.db);
 const row=store.db.prepare("SELECT * FROM sources WHERE instrument_id='NEW' AND id LIKE 'foreign-news-%'").get();const p=JSON.parse(row.policy_json);assert.equal(p.sector,'finance');assert.ok(p.domains.includes('bankingdive.com'));const u=new URL(row.url);assert.equal(u.searchParams.get('hl'),'en-US');assert.ok(u.searchParams.get('q').includes('site:finextra.com'));
 assert.equal(publicationProfile({name:'Example Pharma',type:'stock',group_name:'biofarmaceutyka'}).sector,'health');
 }finally{store.db.close();}
});
test('oryginalne nagłówki nie uruchamiają AI nawet przy starej kolejce i zapisanych tłumaczeniach',async()=>{
 const store=createStore(':memory:',catalog);try{
 store.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 const ids=['queued','running','failed'].map((state,n)=>{const id=add(store,'AKCJA-001','Nvidia original headline '+n,'legacy-'+n);store.db.prepare('UPDATE articles SET translation_state=? WHERE id=?').run(state,id);return id;});
 store.db.prepare("UPDATE articles SET title_pl='Stare tłumaczenie' WHERE id=?").run(ids[0]);
 let calls=0,checks=0;assert.equal((await processPublicationWork(store,{runModel:async()=>{calls++;},available:async()=>{checks++;return true;}})).status,'disabled');
 assert.equal(calls,0);assert.equal(checks,0);assert.deepEqual(headlineStatus(store.db),{enabled:false,mode:'original',used:0,limit:0,pending:0});
 const a=store.db.prepare('SELECT * FROM articles WHERE id=?').get(ids[0]);assert.equal(a.title,'Nvidia original headline 0');
 assert.equal(selectPublications([{...a,instrument_name:'NVIDIA'}],{query:'original headline'}).length,1);
 assert.equal(selectPublications([{...a,instrument_name:'NVIDIA'}],{query:'Stare tłumaczenie'}).length,0);
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 }finally{store.db.close();}
});
test('wyłączenie kończy stare oczekujące zadania bez modelu i zachowuje zapisany wynik oraz źródła',async()=>{
 const store=createStore(':memory:',catalog);try{
 const queued=add(store,'AKCJA-001','Nvidia queued','q'),running=add(store,'AKCJA-001','Nvidia running','r'),done=add(store,'AKCJA-001','Nvidia done','d');
 for(const id of [queued,running,done])store.enqueue(id);
 store.db.prepare("UPDATE jobs SET status='running',lease='lease' WHERE article_id=?").run(running);
 store.db.prepare("UPDATE jobs SET status='done' WHERE article_id=?").run(done);store.db.prepare("UPDATE articles SET summary='Historyczny tekst' WHERE id=?").run(done);
 let calls=0;const result=await processPublicationWork(store,{runModel:async()=>{calls++;},available:async()=>{calls++;return true;},fetcher:async()=>{calls++;}});
 assert.equal(result.status,'disabled');assert.equal(calls,0);
 for(const id of [queued,running]){const j=store.db.prepare('SELECT * FROM jobs WHERE article_id=?').get(id);assert.equal(j.status,'failed');assert.equal(j.lease,null);assert.match(j.error,/wyłączone/);}
 assert.equal(store.db.prepare('SELECT summary FROM articles WHERE id=?').get(done).summary,'Historyczny tekst');assert.equal(store.db.prepare('SELECT status FROM jobs WHERE article_id=?').get(done).status,'done');assert.equal(store.articlesForInstrument('AKCJA-001').length,3);
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


test('most odrzuca tłumaczenia i osobne streszczenia przed wywołaniem CLI',async()=>{
 assert.throws(()=>publicationPrompt({kind:'titles',items:[{id:'1',title:'Nvidia news'}]}),/wyłączone/);
 await assert.rejects(runPublicationAI({kind:'titles',items:[{id:'1',title:'Nvidia news'}]},{bin:'/nie-wolno-uruchomić'}),/wyłączone/);
 assert.throws(()=>publicationPrompt({kind:'summary',article:{title:'Original title'}}),/wyłączone/);
 await assert.rejects(runPublicationAI({kind:'summary',article:{title:'Original',text:'Treść',basis:'article'}},{bin:'/nie-wolno-uruchomić'}),/wyłączone/);
});
test('komunikaty własnego emitenta są oddzielone od artykułów portali i wymagają jego domeny',()=>{
 const sources=generatedSources(catalog.items[0]),source=sources.find(s=>s.policy.kind==='press_search');assert.ok(source);assert.ok(source.policy.domains.includes('nvidia.com'));
 const item={title:'NVIDIA Announces Results',url:'https://news.google.com/rss/articles/release',publisher_url:'https://nvidianews.nvidia.com',publisher_name:'NVIDIA'};const accepted=acceptPublication({...source,policy_json:JSON.stringify(source.policy)},item);assert.equal(accepted.publication_kind,'press');assert.equal(acceptPublication({...source,policy_json:JSON.stringify(source.policy)},{...item,publisher_url:'https://reuters.com'}),null);
 const articles=[{id:'p',published_at:'2026-11-03T12:00:00Z',publication_kind:'press',category:'wyniki'},{id:'a',published_at:'2026-11-03T12:00:00Z',publication_kind:'article',category:'wyniki'}];assert.deepEqual(selectPublications(articles,{category:'komunikaty',now:'2026-11-03T18:00:00Z'}).map(a=>a.id),['p']);
 const etf=generatedSources({id:'ETF-001',name:'WisdomTree Europe Defence UCITS ETF',type:'etf',group_name:'obronność'}).find(s=>s.policy.kind==='press_search');assert.ok(etf.policy.domains.includes('wisdomtree.eu'));
});
test('przerwany proces nie zostawia podsumowania na zawsze w stanie pracy i nie ponawia modelu',async()=>{
 const store=createStore(':memory:',catalog);try{const id=add(store,'AKCJA-001');store.enqueue(id);store.claim(300);store.db.prepare("UPDATE jobs SET lease_until='2020-01-01'").run();let calls=0;await processPublicationWork(store,{runModel:async()=>{calls++;}});assert.equal(store.db.prepare('SELECT status FROM jobs').get().status,'failed');assert.equal(calls,0);}finally{store.db.close();}
});




test('sprawdzenie treści obejmuje obserwowane i portfel, bez AI i bez pozostałych podmiotów',async()=>{
 const {checkPublicationAccess}=await import('../lib/article-access.mjs');const store=createStore(':memory:',catalog);
 try{const watched=add(store,'AKCJA-001'),bought=add(store,'AKCJA-002'),other=add(store,'AKCJA-005');store.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();store.db.prepare("INSERT INTO purchases VALUES('buy','AKCJA-002',1,100,'USD','2026-11-01','2026-11-01')").run();let calls=0;
 const result=await checkPublicationAccess(store,{fetcher:async()=>{calls++;return new Response('<article>'+('Publiczna treść artykułu. '.repeat(20))+'</article>');}});assert.equal(result.checked,2);assert.equal(result.available,2);assert.equal(calls,2);assert.equal(store.db.prepare('SELECT content_status FROM articles WHERE id=?').get(watched).content_status,'available');assert.ok(store.db.prepare('SELECT content_text FROM articles WHERE id=?').get(bought).content_text);assert.equal(store.db.prepare('SELECT content_status FROM articles WHERE id=?').get(other).content_status,null);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 await checkPublicationAccess(store,{fetcher:async()=>new Response('',{status:403})});assert.equal(store.db.prepare('SELECT content_status FROM articles WHERE id=?').get(watched).content_status,'unavailable');assert.equal(store.db.prepare('SELECT content_text FROM articles WHERE id=?').get(watched).content_text,null);
 }finally{store.db.close();}
});
test('odświeżenie RSS 304 nadal sprawdza dostęp do zapisanych artykułów',async()=>{
 const {collect}=await import('../lib/collector.mjs');const store=createStore(':memory:',catalog);
 try{add(store,'AKCJA-001');store.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();const result=await collect(store,{fetcher:async url=>new URL(url).hostname==='www.reuters.com'?new Response('<article>'+('Publiczna treść branżowa. '.repeat(20))+'</article>'):new Response(null,{status:304})});assert.equal(result.articleAccess.checked,1);assert.equal(result.articleAccess.available,1);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 }finally{store.db.close();}
});
