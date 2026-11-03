import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeInstrumentArticles,summaryNeedsRefresh,summaryVersion} from '../public/portfolio.js';

test('gotowy wynik profilu zastępuje stary status z dashboardu i zachowuje inne podmioty',()=>{
 const old={id:'a',instrument_id:'stock-1',content_hash:'same',summary:null,job_status:'queued'};
 const other={id:'b',instrument_id:'stock-2',summary:'Inny tekst'};
 const fresh={...old,summary:'Gotowe podsumowanie po polsku.',job_status:'done',ai_at:'2026-11-03T12:00:00Z'};
 const result=mergeInstrumentArticles([old,other],'stock-1',[fresh]);
 assert.equal(result.find(a=>a.id==='a').summary,fresh.summary);assert.equal(result[1],other);
 assert.equal(summaryNeedsRefresh(old),true);assert.equal(summaryNeedsRefresh(result[0]),false);
 assert.notEqual(summaryVersion(old),summaryVersion(result[0]));
});

test('usunięty artykuł znika z pamięci profilu, nowe trafiają do niej, obcy podmiot nie jest podmieniany',()=>{
 const other={id:'other',instrument_id:'stock-2'},old={id:'gone',instrument_id:'stock-1'},added={id:'new',instrument_id:'stock-1'};
 assert.deepEqual(mergeInstrumentArticles([old,other],'stock-1',[added,{...other,summary:'Nie podmieniaj'}]),[other,added]);
});

test('spóźniona odpowiedź nie usuwa gotowego podsumowania, ale nowa wersja artykułu może je wyczyścić',()=>{
 const ready={id:'a',instrument_id:'stock-1',content_hash:'revision-1',summary:'Gotowe',job_status:'done'};
 const old={...ready,summary:null,job_status:'running'};
 assert.equal(mergeInstrumentArticles([ready],'stock-1',[old])[0].summary,'Gotowe');
 assert.equal(mergeInstrumentArticles([ready],'stock-1',[{...old,content_hash:'revision-2'}])[0].summary,null);
});

test('odświeżanie dotyczy wyłącznie oczekujących wyników; błąd nie zleca ponownie modelu',()=>{
 assert.equal(summaryNeedsRefresh({job_status:'queued'}),true);assert.equal(summaryNeedsRefresh({job_status:'running'}),true);
 for(const a of [null,{}, {job_status:'failed'},{job_status:'done'},{job_status:'queued',summary:'Gotowe'}])assert.equal(summaryNeedsRefresh(a),false);
 assert.notEqual(summaryVersion({job_status:'queued'}),summaryVersion({job_status:'running'}));
});
