import {syncBriefMonitors} from '../lib/brief-monitor.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {insightSlot,insightInput,queueInsights,processInsightWork,insightFor,markInsightRead,validateInsight,retryInsight} from '../lib/company-insights.mjs';
import {insightBody,briefBody} from '../public/company-insights.js';
import {publicationModelFor,publicationPrompt} from '../scripts/publication-ai.mjs';
const now=new Date('2026-11-04T14:00:00Z');
function fixture(t){const s=createStore(':memory:',{items:[1,2,3].map(n=>({id:'AKCJA-00'+n,name_on_screenshot:['NVIDIA','Microsoft','Broadcom'][n-1],type:'stock',working_group:'technologia'}))});t.after(()=>s.db.close());return s;}
function add(s,id='AKCJA-001',suffix='a',title='NVIDIA announced results',published='2026-11-04T12:00:00Z'){
 syncBriefMonitors(s.db,new Date('2026-11-04T00:00:00Z'));
 return s.ingest({id:'foreign-news-'+id.toLowerCase(),instrument_id:id},{title,excerpt:'Revenue increased. A launch is planned.',url:'https://www.reuters.com/technology/'+suffix,published_at:published,category:'wyniki',eligible:1,publisher_name:'Reuters',publisher_url:'https://www.reuters.com'}).id;
}
function answer(task,changed=true){const source=task.articles[0].id;return {overview:{text:'Spółka opublikowała wyniki.',sources:[source]},drivers:[],risks:[],events:[{text:'Publikacja wyników.',sources:[source]}],actions:[],deadlines:[],price_context:'Brak potwierdzonych informacji o przyczynie ruchu kursu.',limitations:'Na podstawie nagłówków i fragmentów RSS.',material_changed:changed};}
test('opisy są sprawdzane w poniedziałki i czwartki o 14:30 czasu polskiego',()=>{
 assert.equal(insightSlot(true,new Date('2026-11-05T13:29:59Z')),null);
 assert.equal(insightSlot(true,new Date('2026-11-05T13:30:00Z')),'2026-11-05/14:30');
 assert.equal(insightSlot(true,new Date('2026-11-09T13:30:00Z')),'2026-11-09/14:30');
 assert.equal(insightSlot(true,new Date('2026-07-02T12:30:00Z')),'2026-07-02/14:30');
 assert.equal(insightSlot(true,new Date('2026-11-04T15:00:00Z')),null);
 assert.equal(insightSlot(false,new Date('2026-11-05T13:30:00Z')),null);
});
test('zakres osobisty łączy obserwowane i portfel; pozostali i puste materiały nie zlecają AI',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();s.db.prepare("INSERT INTO purchases VALUES('p','AKCJA-002',1,1,'USD','2026-11-01','2026-11-01')").run();
 add(s);add(s,'AKCJA-002','m','Microsoft released results');add(s,'AKCJA-003','b','Broadcom released results');
 assert.equal(queueInsights(s,{now,scope:'personal'}).queued,2);assert.equal(queueInsights(s,{now,scope:'personal'}).queued,0);
 assert.equal(s.db.prepare("SELECT COUNT(*) n FROM insight_jobs WHERE instrument_id='AKCJA-003'").get().n,0);
 let calls=0;const runModel=async task=>{calls++;return answer(task);};
 await processInsightWork(s,{now,scope:'personal',runModel});await processInsightWork(s,{now,scope:'personal',runModel});
 assert.equal((await processInsightWork(s,{now,scope:'personal',runModel})).status,'empty');assert.equal(calls,2);
 queueInsights(s,{now:new Date('2026-11-05T14:00:00Z'),scope:'personal'});
 assert.equal((await processInsightWork(s,{now:new Date('2026-11-05T14:00:00Z'),scope:'personal',runModel})).status,'empty');assert.equal(calls,2);
});
test('pusta kolejka, wyłączony zakres i usunięcie z obserwowanych nie wywołują modelu',async t=>{
 const s=fixture(t);let calls=0;const runModel=async()=>{calls++;throw Error('Nie wolno wywołać');};
 assert.equal(queueInsights(s,{now,scope:'personal'}).queued,0);
 assert.equal((await processInsightWork(s,{now,scope:'personal',runModel})).status,'empty');
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);queueInsights(s,{now,scope:'personal'});
 assert.equal((await processInsightWork(s,{now,runModel})).status,'disabled');
 s.db.prepare('UPDATE instruments SET watched=0').run();assert.equal((await processInsightWork(s,{now,scope:'personal',runModel})).status,'empty');assert.equal(calls,0);
});
test('brief bierze najwyżej 20 nowych materiałów; bez historii i przyszłych dat',t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();for(let n=0;n<25;n++)add(s,'AKCJA-001',String(n),'Nvidia news '+n);
 add(s,'AKCJA-001','duplicate','Nvidia news 1');add(s,'AKCJA-001','old','Old release','2026-10-01T12:00:00Z');add(s,'AKCJA-001','future','Future release','2026-11-06T12:00:00Z');
 const x=insightInput(s.db,'AKCJA-001',now);assert.equal(x.articles.length,20);assert.ok(x.articles.every(a=>!['Old release','Future release'].includes(a.title)));
 assert.equal(x.input_hash,insightInput(s.db,'AKCJA-001',new Date('2026-11-04T20:00:00Z')).input_hash);
});
test('kontrolka jest trwała, nie gaśnie od spóźnionego odczytu i nie wraca po samym sprawdzeniu',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);queueInsights(s,{now,scope:'personal'});
 await processInsightWork(s,{now,scope:'personal',runModel:async task=>answer(task)});
 const first=insightFor(s.db,'AKCJA-001',now);assert.equal(first.unread,true);
 assert.equal(markInsightRead(s.db,'AKCJA-001','0'.repeat(64)),0);assert.equal(insightFor(s.db,'AKCJA-001',now).unread,true);
 assert.equal(markInsightRead(s.db,'AKCJA-001',first.material_hash),1);assert.equal(insightFor(s.db,'AKCJA-001',now).unread,false);
 add(s,'AKCJA-001','new','Another account of the same results','2026-11-05T12:00:00Z');const next=new Date('2026-11-05T14:00:00Z');queueInsights(s,{now:next,scope:'personal'});
 await processInsightWork(s,{now:next,scope:'personal',runModel:async task=>answer(task,false)});
 const second=insightFor(s.db,'AKCJA-001',next);assert.equal(second.unread,false);assert.equal(second.material_hash,first.material_hash);
 add(s,'AKCJA-001','contract','A major contract signed','2026-11-06T12:00:00Z');const third=new Date('2026-11-09T14:00:00Z');queueInsights(s,{now:third,scope:'personal'});
 await processInsightWork(s,{now:third,scope:'personal',runModel:async task=>({...answer(task),overview:{text:'Podpisano istotny kontrakt.',sources:[task.articles[0].id]}})});
 assert.equal(insightFor(s.db,'AKCJA-001',third).unread,true);assert.equal(markInsightRead(s.db,'AKCJA-001',first.material_hash),0);
});
test('błąd modelu nie powoduje automatycznych ponowień; użytkownik może ponowić',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);queueInsights(s,{now,scope:'personal'});let calls=0;
 const runModel=async()=>{calls++;throw Error('Limit');};
 await processInsightWork(s,{now,scope:'personal',runModel});queueInsights(s,{now:new Date('2026-11-05T14:00:00Z'),scope:'personal'});await processInsightWork(s,{now,scope:'personal',runModel});assert.equal(calls,1);
 retryInsight(s.db,'AKCJA-001');await processInsightWork(s,{now,scope:'personal',runModel});assert.equal(calls,2);
});
test('zmiana lub wygaśnięcie źródeł ukrywa stary opis; przestarzały wynik nie jest publikowany',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();const id=add(s);queueInsights(s,{now,scope:'personal'});
 await processInsightWork(s,{now,scope:'personal',runModel:async task=>answer(task)});
 assert.equal(insightFor(s.db,'AKCJA-001',new Date('2027-05-05T14:00:00Z')).content,null);
 s.db.prepare("UPDATE articles SET content_hash='changed' WHERE id=?").run(id);assert.equal(insightFor(s.db,'AKCJA-001',now).content,null);
 const next=new Date('2026-11-05T14:00:00Z');queueInsights(s,{now:next,scope:'personal'});
 const r=await processInsightWork(s,{now:next,scope:'personal',runModel:async task=>{s.db.prepare("UPDATE articles SET content_hash='changed-again' WHERE id=?").run(id);return answer(task);}});assert.equal(r.status,'failed');
});
test('nie wolno dopisać obcego źródła lub terminu bez dowodu w kalendarzu',t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);const input=insightInput(s.db,'AKCJA-001',now),v=answer(input);
 assert.throws(()=>validateInsight({...v,risks:[{text:'Ryzyko',sources:['fake']}]},input));
 const d={text:'Wyniki',sources:[input.articles[0].id],date:'2026-11-10',certainty:'confirmed'};
 assert.throws(()=>validateInsight({...v,deadlines:[d]},input));
 input.events=[{article_id:input.articles[0].id,event_date:d.date,certainty:'confirmed'}];assert.equal(validateInsight({...v,deadlines:[d]},input).deadlines.length,1);
});
test('renderowanie jest bezpieczne i pokazuje pełne publikacje tylko jako przycisk pod briefem',()=>{
 const task={articles:[{id:'a'}]},n={status:'done',content:answer(task),sources:[{id:'a',url:'javascript:alert(1)',publisher:'Źródło'}]};
 n.content.overview.text='<script>alert(1)</script>';
 const html=insightBody({id:'x',personal:true},n);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('Brief prasowy'));assert.ok(!html.includes('<ul>'));const brief=briefBody({id:'x',personal:true},n);assert.ok(brief.indexOf('Wszystkie publikacje')>brief.indexOf('Brief prasowy'));assert.ok(!brief.includes('href="javascript:'));
 assert.ok(insightBody({id:'x',personal:false},n).includes('Dodaj do obserwowanych'));
 assert.equal(publicationModelFor('insight'),'gpt-6.1-sol');assert.throws(()=>publicationModelFor('titles'),/Niepoprawny rodzaj zadania/);assert.throws(()=>publicationModelFor('summary'),/Niepoprawny rodzaj zadania/);assert.ok(publicationPrompt({kind:'insight',instrument:{name:'Nvidia'},articles:[{id:'a',title:'Results',excerpt:'',url:'https://example.com',published_at:now.toISOString()}],events:[]}).includes('nie jest źródłem'));
});

test('nowy punkt briefu jest zapisywany także bez zmiany ogólnego opisu',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);queueInsights(s,{now,scope:'personal'});
 await processInsightWork(s,{now,scope:'personal',runModel:async task=>answer(task)});
 const first=insightFor(s.db,'AKCJA-001',now);markInsightRead(s.db,'AKCJA-001',first.material_hash);
 add(s,'AKCJA-001','new-event','NVIDIA signs a new contract','2026-11-05T12:00:00Z');
 const next=new Date('2026-11-05T14:00:00Z');queueInsights(s,{now:next,scope:'personal'});
 await processInsightWork(s,{now:next,scope:'personal',runModel:async task=>({...answer(task,false),events:[],actions:[{text:'Podpisano nowy kontrakt.',sources:[task.articles[0].id]}]})});
 const result=insightFor(s.db,'AKCJA-001',next);assert.equal(result.content.actions.length,1);assert.equal(result.content.events.length,1);assert.equal(result.unread,true);
});

test('pusty ukończony brief można poprawić raz na żądanie, bez automatycznego ponawiania',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();add(s);queueInsights(s,{now,scope:'personal'});let calls=0;
 await processInsightWork(s,{now,scope:'personal',runModel:async task=>{calls++;return {...answer(task),events:[]};}});
 await processInsightWork(s,{now,scope:'personal',runModel:async()=>{calls++;}});assert.equal(calls,1);
 retryInsight(s.db,'AKCJA-001');assert.throws(()=>retryInsight(s.db,'AKCJA-001'));
 await processInsightWork(s,{now,scope:'personal',runModel:async task=>{calls++;assert.equal(task.articles.length,1);return answer(task,false);}});
 assert.equal(calls,2);assert.equal(insightFor(s.db,'AKCJA-001',now).content.events.length,1);
});

test('brief odróżnia pracę, błąd i pusty ukończony wynik, a prose nie pokazuje UUID',()=>{
 const i={id:'x',personal:true};assert.match(briefBody(i,{status:'running'}),/Przygotowuję brief/);
 assert.match(briefBody(i,{status:'failed'}),/Ponów opracowanie/);assert.match(briefBody(i,{status:'done'}),/Uzupełnij brief/);
 const id='0b5656cb-96ca-4eb9-abc3-0a765bf903fa';
 const html=insightBody(i,{content:{overview:{text:'Opublikowano wyniki. ['+id+']',sources:[id]},drivers:[{text:'Wyniki: wzrosły przychody.',sources:[id]}],risks:[]},sources:[{id,url:'https://example.com',publisher:'Źródło'}]});
 assert.ok(!html.includes(id));assert.ok(html.includes('<strong>Wyniki:</strong>'));assert.ok(html.includes('[1]'));
});

test('nowe opracowanie używa dostępnego tekstu w cache z niezmienionym łącznym budżetem',t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();const id=add(s);
 s.db.prepare("UPDATE articles SET content_status='available',content_text=? WHERE id=?").run('Treść artykułu. '.repeat(300),id);
 const x=insightInput(s.db,'AKCJA-001',now);assert.equal(x.articles[0].basis,'fragment tekstu artykułu');assert.equal(x.articles[0].excerpt.length,1600);
 assert.ok(x.articles.reduce((n,a)=>n+a.excerpt.length,0)<=8000);
});

test('długie linki nie tworzą zadania przekraczającego limit mostu',t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 for(let n=0;n<20;n++){const id=add(s,'AKCJA-001','large-'+n,'NVIDIA update '+n);s.db.prepare('UPDATE articles SET url=?,excerpt=? WHERE id=?').run('https://www.reuters.com/'+String(n)+'x'.repeat(1600),'Materiał źródłowy. '.repeat(50),id);}
 const task=insightInput(s.db,'AKCJA-001',now);assert.ok(task.articles.length<20);assert.ok(task.articles.length>0);assert.ok(JSON.stringify(task).length<22000);
});
test('pierwszy opis nowo obserwowanej spółki nie czeka na poniedziałek i nie dopisuje historii briefu',async t=>{
 const s=fixture(t);s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-001'").run();
 add(s,'AKCJA-001','before-watch','Company published verified financial results','2026-11-02T12:00:00Z');
 const start=new Date('2026-11-04T09:00:00Z');
 assert.equal(queueInsights(s,{now:start,scope:'personal'}).queued,1);
 const job=s.db.prepare('SELECT input_json FROM insight_jobs').get(),input=JSON.parse(job.input_json);assert.equal(input.initial,true);assert.deepEqual(input.brief_article_ids,[]);
 const result=await processInsightWork(s,{now:start,scope:'personal',runModel:async task=>({...answer(task),events:[]})});
 assert.equal(result.status,'done');assert.ok(insightFor(s.db,'AKCJA-001',start).content.overview.text);assert.equal(insightFor(s.db,'AKCJA-001',start).content.events.length,0);
 add(s,'AKCJA-001','new-wednesday','Company announced a new contract','2026-11-04T10:00:00Z');
 assert.equal(queueInsights(s,{now:new Date('2026-11-04T14:00:00Z'),scope:'personal'}).queued,0);
 assert.equal(queueInsights(s,{now:new Date('2026-11-05T13:29:59Z'),scope:'personal'}).queued,0);
 assert.equal(queueInsights(s,{now:new Date('2026-11-05T13:30:00Z'),scope:'personal'}).queued,1);
 assert.equal(queueInsights(s,{now:new Date('2026-11-05T15:00:00Z'),scope:'personal'}).queued,0);
});
