import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../lib/store.mjs';
import { parseRss, validDay, validateSummary, publicationSince } from '../lib/core.mjs';
import { collect } from '../lib/collector.mjs';
import { runOnce } from '../scripts/codex-worker.mjs';

const catalog={items:[1,2,3].map(n=>({id:`AKCJA-00${n}`,name_on_screenshot:'Firma '+n,type:'stock',working_group:'test'}))};
const item={title:'Results on November 20, 2026',url:'https://example.com/news/1',excerpt:'Results on November 20, 2026. Signed agreement.',published_at:'2026-11-01T10:00:00Z',category:'wyniki'};
const src={id:'microsoft-news',instrument_id:'AKCJA-002'};
const summary={title_pl:'Wyniki 20 listopada 2026',summary:'Spółka zapowiedziała publikację.',significance:'Poznamy wyniki.',category:'wyniki',events:[{title:'Wyniki',date:'2026-11-20',certainty:'confirmed',evidence:'Results on November 20, 2026'}]};
function storeFor(t){const s=createStore(':memory:',catalog);t.after(()=>s.db.close());return s;}
test('RSS nie traktuje pubDate jako daty wydarzenia i odrzuca niebezpieczne linki',()=>{
  const x=parseRss('<rss><channel><item><title><![CDATA[Company &amp; results]]></title><link>https://example.com/a?utm_source=rss</link><description><![CDATA[<p>Hello</p>]]></description><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item><item><title>bad</title><link>javascript:alert(1)</link></item></channel></rss>');
  assert.equal(x.length,1);assert.equal(x[0].title,'Company & results');assert.equal(x[0].url,'https://example.com/a');assert.equal(x[0].published_at,'2026-11-02T10:00:00.000Z');assert.equal(x[0].event_date,undefined);
});
test('odrzuca encje zewnętrzne i HTML zamiast RSS',()=>{
  assert.throws(()=>parseRss('<!DOCTYPE foo><rss/>'));assert.throws(()=>parseRss('<html>Forbidden</html>'));
});
test('duplikaty nie tworzą kolejnych zadań, zmiana zachowuje historię',t=>{
  const s=storeFor(t),a=s.ingest(src,item);assert.equal(s.ingest(src,item).changed,false);s.enqueue(a.id);s.enqueue(a.id);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,1);
  s.ingest(src,{...item,excerpt:item.excerpt+' Update.'});assert.equal(s.db.prepare('SELECT COUNT(*) n FROM revisions').get().n,1);
  assert.equal(s.db.prepare('SELECT status FROM jobs').get().status,'superseded');
});
test('limit dzienny i atomowe pobieranie zadania',t=>{
  const s=storeFor(t);s.enqueue(s.ingest(src,item).id);const first=s.claim(1);assert.ok(first.job);
  assert.equal(s.claim(1).reason,'daily_limit');s.finish(first.job.id,first.job.lease,null,'test');
  s.db.prepare("UPDATE jobs SET status='queued' WHERE id=?").run(first.job.id);
  assert.equal(s.claim(1).reason,'daily_limit');
});
test('fałszywy token i przestarzała notatka nie zapisują wyniku',t=>{
  const s=storeFor(t),a=s.ingest(src,item);s.enqueue(a.id);const {job}=s.claim(3);
  assert.throws(()=>s.finish(job.id,'wrong',summary));s.ingest(src,{...item,title:'Corrected title'});
  assert.throws(()=>s.finish(job.id,job.lease,summary));
});
test('data kalendarza wymaga poprawnej daty i cytatu; zapisuje się automatycznie',t=>{
  assert.equal(validDay('2026-02-30'),false);assert.throws(()=>validateSummary({...summary,events:[{...summary.events[0],evidence:'Invented exact date'}]},item));
  const s=storeFor(t);s.enqueue(s.ingest(src,item).id);const {job}=s.claim(3);s.finish(job.id,job.lease,summary);
  assert.equal(s.db.prepare('SELECT review_status FROM events').get().review_status,'approved');
});
test('pusta kolejka nie uruchamia modelu',async()=>{
  let calls=0;const r=await runOnce({base:'https://example.com',token:'test',fetcher:async()=>new Response(JSON.stringify({job:null,reason:'empty'})),runModel:async()=>{calls++;}});
  assert.equal(r.status,'empty');assert.equal(calls,0);
});
test('zapis wyniku procesu bez prawdziwego wywołania AI',async()=>{
  const requests=[];const job={...item,id:'j',lease:'l',instrument_name:'Test'};
  const result=await runOnce({base:'https://example.com',token:'test',fetcher:async(url,opt)=>{requests.push({url:String(url),body:JSON.parse(opt.body)});return new Response(JSON.stringify(requests.length===1?{job}:{ok:true}));},runModel:async()=>summary});
  assert.equal(result.status,'done');assert.equal(requests[1].body.result.events[0].date,'2026-11-20');
});
test('blokada źródła zatrzymuje pobieranie zagranicznych publikacji bez modelu',async t=>{
  const s=storeFor(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-002'").run();
  const result=await collect(s,{fetcher:async()=>new Response('Forbidden',{status:403})});
  assert.ok(result.sources.length<=3);assert.ok(result.blocked);assert.ok(result.sources.every(x=>x.status==='error'));assert.equal(s.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
});

test('tłumaczenie nagłówka jest wymagane; cytat pozostaje w oryginale',()=>{assert.throws(()=>validateSummary({...summary,title_pl:''},item));assert.equal(validateSummary(summary,item).events[0].evidence,'Results on November 20, 2026');});

test('okno publikacji to miesiąc kalendarzowy, z poprawnym końcem lutego',()=>{
 assert.equal(publicationSince(new Date('2026-11-02T12:00:00Z')),'2026-10-02T00:00:00.000Z');
 assert.equal(publicationSince(new Date('2026-03-31T12:00:00Z')),'2026-02-28T00:00:00.000Z');
 assert.equal(publicationSince(new Date('2024-03-31T12:00:00Z')),'2024-02-29T00:00:00.000Z');
});
test('pobranie publikacji nie zleca AI nawet przy włączonych dawnych flagach automatyzacji',async t=>{
 const s=storeFor(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 const previous={auto:process.env.AI_AUTOMATION_ENABLED,worker:process.env.CODEX_RUN_ENABLED};
 process.env.AI_AUTOMATION_ENABLED='1';process.env.CODEX_RUN_ENABLED='1';
 try{const rss=`<rss><channel><item><title>Nvidia announces a new product</title><link>https://nvidianews.nvidia.com/manual-only</link><pubDate>${new Date().toUTCString()}</pubDate><description>Fragment</description></item></channel></rss>`;
 const result=await collect(s,{fetcher:async url=>new URL(url).hostname==='nvidianews.nvidia.com'?new Response(rss):new Response('',{status:404})});assert.equal(result.added,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 const id=s.db.prepare('SELECT id FROM articles').get().id;s.enqueue(id);assert.equal(s.db.prepare('SELECT user_requested FROM jobs').get().user_requested,1);assert.ok(s.claim(10).job);
 }finally{for(const [key,value] of [['AI_AUTOMATION_ENABLED',previous.auto],['CODEX_RUN_ENABLED',previous.worker]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
