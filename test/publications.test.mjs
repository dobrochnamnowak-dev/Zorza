import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPublications,publicationDay} from '../public/portfolio.js';
import {createStore} from '../lib/store.mjs';
const articles=[{id:'old',published_at:'2026-09-01T10:00:00Z',category:'wyniki',starred:1},{id:'a',published_at:'2026-11-02T12:00:00Z',category:'wyniki'},{id:'b',published_at:'2026-11-02T08:00:00Z',category:'kontrakty',starred:1},{id:'gone',published_at:'2026-11-02T12:00:00Z',deleted_at:'2026-11-02'}];
const opts={now:'2026-11-02T15:00:00Z'};
test('gwiazdka ma pierwszeństwo, a poprzednie dni trafiają do archiwum także po miesiącu',()=>{
 assert.deepEqual(selectPublications(articles,opts).map(a=>a.id),['b','a']);
 assert.deepEqual(selectPublications(articles,{...opts,view:'archive'}).map(a=>a.id),['old']);
 assert.equal(publicationDay('2026-11-01T23:30:00Z'),'2026-11-02');
 assert.deepEqual(selectPublications(articles,{...opts,category:'wyniki'}).map(a=>a.id),['a']);
 assert.deepEqual(selectPublications(articles,{...opts,view:'archive',from:'2026-10-01'}),[]);
 assert.deepEqual(selectPublications(articles,{...opts,category:'ważne'}).map(a=>a.id),['b']);
});
test('gwiazdka i usunięcie są trwałe, ponowne pobranie nie przywraca usuniętego tekstu',()=>{
 const store=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'technologia'}]});
 try{const source={id:'nvidia-news',instrument_id:'AKCJA-001'};const item={title:'News',excerpt:'Fragment',published_at:'2026-11-02T10:00:00Z',url:'https://example.com/news',category:'inne'};const {id}=store.ingest(source,item);
 store.editArticle(id,true);assert.equal(store.db.prepare('SELECT starred FROM articles WHERE id=?').get(id).starred,1);
 store.enqueue(id);store.editArticle(id,undefined,true);assert.throws(()=>store.enqueue(id));assert.equal(store.ingest(source,{...item,title:'Zmieniony'}).changed,false);assert.ok(store.db.prepare('SELECT deleted_at FROM articles WHERE id=?').get(id).deleted_at);assert.equal(store.claim(10).job,null);
 }finally{store.db.close();}
});
test('profil zawiera ponad 15 artykułów, także archiwalne i nieobserwowanego podmiotu',()=>{
 const store=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'technologia'},{id:'AKCJA-002',name_on_screenshot:'Microsoft',type:'stock',working_group:'technologia'}]});
 try{const source={id:'nvidia-news',instrument_id:'AKCJA-001'};for(let n=0;n<22;n++)store.ingest(source,{title:'Article '+n,excerpt:'Fragment',eligible:1,url:'https://example.com/'+n,published_at:'2025-01-01T10:00:00Z',category:'inne'});
 const all=store.articlesForInstrument('AKCJA-001');assert.equal(all.length,22);assert.equal(store.articlesForInstrument('AKCJA-002').length,0);store.editArticle(all[0].id,undefined,true);assert.equal(store.articlesForInstrument('AKCJA-001').length,21);
 }finally{store.db.close();}
});
test('okresy dzisiaj, wczoraj, ostatni tydzień i archiwum działają z datą polską',()=>{
 const now='2026-11-03T12:00:00Z';const items=['2026-11-03','2026-11-02','2026-11-01','2026-10-28','2026-10-27'].map(day=>({id:day,published_at:day+'T12:00:00Z',category:'inne'}));
 assert.deepEqual(selectPublications(items,{now,view:'week'}).map(a=>a.id),['2026-11-03','2026-11-02','2026-11-01','2026-10-28']);
 assert.deepEqual(selectPublications(items,{now,view:'yesterday',from:'2026-11-03'}).map(a=>a.id),['2026-11-02']);
 assert.deepEqual(selectPublications(items,{now,view:'today',to:'2026-10-01'}).map(a=>a.id),['2026-11-03']);
 assert.deepEqual(selectPublications(items,{now,view:'week',from:'2026-11-01',to:'2026-11-02'}).map(a=>a.id),['2026-11-02','2026-11-01']);
 assert.equal(selectPublications(items,{now,view:'archive'}).length,2);
});
