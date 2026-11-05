import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatSync} from '../scripts/chat-sync.mjs';
import {mergeChatSnapshot,mergeDashboard} from '../public/data-sync.js';
import {createStore} from '../lib/store.mjs';
import {createArticleReader,createArticleReaderPool} from '../lib/article-reader.mjs';
import {checkPublicationAccess} from '../lib/article-access.mjs';
import {collectCalendarDates} from '../lib/calendar-fetch.mjs';

function fixture(t){const s=createStore(':memory:',{items:[{id:'AKCJA-001',name_on_screenshot:'NVIDIA',type:'stock',working_group:'technologia'}]});t.after(()=>s.db.close());return s;}
const instrument={id:'AKCJA-001',name:'NVIDIA',type:'stock',group_name:'technologia'};
const source={title:'NVIDIA will report financial results',url:'https://www.reuters.com/technology/nvidia',publisher_url:'https://www.reuters.com',excerpt:'RSS',content_hash:'v1'};
const html=extra=>'<article>'+('NVIDIA reported revenue. '.repeat(25))+(extra||'')+'</article>';

test('czat przesyła zdjęcie raz; bez zmian nie przesyła historii, a streaming zmienia tylko odpowiedź',()=>{
 const sync=createChatSync(),messages=[{role:'user',text:'Sprawdź screen',images:['data:image/jpeg;base64,'+'A'.repeat(400000)]},{id:'reply',role:'assistant',text:'Początek'}];
 const first=sync.snapshot(messages);let client=mergeChatSnapshot(undefined,{sync:first});assert.equal(first.reset,true);assert.equal(client.messages.length,2);
 const idle=sync.snapshot(messages,client.cursor);assert.equal(idle.messages.length,0);assert.equal(idle.reset,false);assert.ok(JSON.stringify(idle).length<JSON.stringify(first).length/100);
 messages[1].text+=' odpowiedzi';sync.touch();const delta=sync.snapshot(messages,client.cursor);assert.equal(delta.messages.length,1);assert.equal(delta.messages[0].id,'reply');assert.equal(delta.messages[0].images,undefined);
 client=mergeChatSnapshot(client,{sync:delta});assert.equal(client.messages[1].text,messages[1].text);assert.equal(client.messages[0].images[0],messages[0].images[0]);
 delete messages[0].images;sync.touch();const cleanup=sync.snapshot(messages,client.cursor);client=mergeChatSnapshot(client,{sync:cleanup});assert.equal(client.messages[0].images,undefined);
 messages.shift();sync.touch();client=mergeChatSnapshot(client,{sync:sync.snapshot(messages,client.cursor)});assert.deepEqual(client.messages.map(m=>m.id),['reply']);
 messages.push({id:'last',role:'user',text:'Nowa wiadomość'});sync.touch();client=mergeChatSnapshot(client,{sync:sync.snapshot(messages,client.cursor)});messages.reverse();sync.touch();const reordered=sync.snapshot(messages,client.cursor);assert.notEqual(reordered.cursor,client.cursor);client=mergeChatSnapshot(client,{sync:reordered});assert.equal(client.messages[0].id,'last');
 const restarted=createChatSync().snapshot(messages,client.cursor);assert.equal(restarted.reset,true);assert.equal(mergeChatSnapshot(client,{sync:restarted}).messages[0].text,messages[0].text);
});
test('czat obsługuje spóźniony cursor, starszy most i niekompletną historię bez znikania wiadomości',()=>{
 const sync=createChatSync(),messages=[{id:'a',role:'user',text:'Pierwsza'}];const first=sync.snapshot(messages);
 messages.push({id:'b',role:'assistant',text:'Druga'});sync.touch();sync.snapshot(messages);
 const catchup=sync.snapshot(messages,first.cursor);assert.equal(catchup.messages.length,1);assert.equal(mergeChatSnapshot({cursor:first.cursor,messages:first.messages},{sync:catchup}).messages.length,2);
 assert.deepEqual(mergeChatSnapshot(undefined,{messages}),{cursor:null,messages});
 assert.throws(()=>mergeChatSnapshot(undefined,{sync:{version:1,cursor:'bad',order:['missing'],messages:[],reset:false}}),/Niekompletna/);
});
test('lekki dashboard zachowuje nowszy kurs, pobrane publikacje i opis tej samej wersji',()=>{
 const previous={quotes:[{instrument_id:'x',price:11,as_of:'2026-11-05T12:00:00Z'}],articles:[{id:'article'}],jobs:[{id:'job'}],events:[{id:'event'}],sources:[{id:'source'}],insights:{x:{status:'done',material_hash:'v1',content:{overview:{text:'Gotowy opis'}},sources:[{id:'a'}],unread:true}}};
 const next={quotes:[{instrument_id:'x',price:10,as_of:'2026-11-05T11:00:00Z'}],omitted:['articles','jobs','events','sources'],insight_summaries:true,insights:{x:{status:'done',material_hash:'v1',unread:false}}};
 const merged=mergeDashboard(previous,next);assert.equal(merged.quotes[0].price,11);assert.equal(merged.articles,previous.articles);assert.ok(merged.insights.x.content);assert.equal(merged.insights.x.unread,false);
 assert.equal(mergeDashboard(previous,{...next,insights:{x:{status:'done',material_hash:'v2'}}}).insights.x.content,undefined);
 assert.deepEqual(mergeDashboard(null,{...next,events:[]}).articles,[]);
});
test('każdy nowy cykl weryfikuje stronę warunkowo; zmiana i odebrany dostęp zastępują poprzedni tekst',async t=>{
 const s=fixture(t);let calls=0;const fetcher=async(url,opts)=>{calls++;if(calls===1)return new Response(html(),{headers:{etag:'"v1"'}});assert.equal(opts.headers['If-None-Match'],'"v1"');if(calls===2)return new Response(null,{status:304});if(calls===3)return new Response(html('New release'),{headers:{etag:'"v2"'}});throw Error('unexpected');};
 const a=await createArticleReader(s,{fetcher}).read(source,instrument);const b=await createArticleReader(s,{fetcher}).read(source,instrument);assert.equal(a.text,b.text);assert.equal(calls,2);
 const c=await createArticleReader(s,{fetcher}).read(source,instrument);assert.match(c.text,/New release/);
 const blocked=await createArticleReader(s,{fetcher:async()=>new Response('',{status:403})}).read(source,instrument);assert.notEqual(blocked.basis,'article');assert.equal(s.db.prepare('SELECT COUNT(*) n FROM article_page_cache').get().n,0);
});
test('brak walidatorów nie pozwala pominąć nowego odczytu; paywall i no-store nie ujawniają starego tekstu',async t=>{
 const s=fixture(t);let calls=0;const fetcher=async()=>{calls++;return new Response(html());};
 await createArticleReader(s,{fetcher}).read(source,instrument);await createArticleReader(s,{fetcher}).read(source,instrument);assert.equal(calls,2);
 const paywall=await createArticleReader(s,{fetcher:async()=>new Response('<script>{"isAccessibleForFree":false}</script>'+html(),{headers:{etag:'blocked'}})}).read(source,instrument);assert.notEqual(paywall.basis,'article');assert.equal(s.db.prepare('SELECT content_text FROM article_page_cache').get().content_text,'');
 await createArticleReader(s,{fetcher:async()=>new Response(html(),{headers:{'cache-control':'no-store'}})}).read(source,instrument);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM article_page_cache').get().n,0);
 let rejectedCalls=0;await createArticleReader(s,{fetcher:async()=>{rejectedCalls++;}}).read({...source,url:'https://not-approved.invalid/article'},instrument);assert.equal(rejectedCalls,0);
});
test('publikacje i kalendarz korzystają z jednego pobrania, a następny slot zachowuje własne sprawdzenie',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 const published=new Date(Date.now()-3600000).toISOString(),future=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 s.ingest({id:'foreign-news-akcja-001',instrument_id:'AKCJA-001'},{...source,publication_kind:'press',published_at:published,eligible:1,category:'wyniki',excerpt:'NVIDIA will report earnings on '+future+'.'});
 let calls=0;const pool=createArticleReaderPool(s,{fetcher:async()=>{calls++;return new Response(html('NVIDIA will report earnings on '+future+'.'),{headers:{etag:'v1'}});}}),reader=pool.forSlot('day/15:40');
 const access=await checkPublicationAccess(s,{reader});const calendar=await collectCalendarDates(s,{reader});assert.equal(access.available,1);assert.equal(calendar.pages,1);assert.equal(calls,1);assert.ok(s.db.prepare('SELECT COUNT(*) n FROM events').get().n>0);
 assert.equal(pool.forSlot('day/15:40'),reader);assert.notEqual(pool.forSlot('day/21:45'),reader);
 await pool.forSlot('day/21:45').read(source,instrument);assert.equal(calls,2);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
});
