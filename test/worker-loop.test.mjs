import test from 'node:test';
import assert from 'node:assert/strict';
import {runLoop,runOnce} from '../scripts/codex-worker.mjs';
test('ciągły proces czeka bez uruchamiania AI dla pustej kolejki',async()=>{
 const controller=new AbortController();let modelCalls=0,checks=0;const pauses=[];
 await runLoop({signal:controller.signal,run:()=>runOnce({base:'https://example.com',token:'test',fetcher:async()=>{checks++;return new Response(JSON.stringify({job:null,reason:'empty'}));},runModel:async()=>{modelCalls++;}}),pause:async ms=>{pauses.push(ms);if(pauses.length===3)controller.abort();}});
 assert.equal(modelCalls,0);assert.equal(checks,0);assert.deepEqual(pauses,[30000,30000,30000]);
});
test('błąd połączenia nie zatrzymuje pętli, a limit wydłuża oczekiwanie',async()=>{
 const controller=new AbortController();let calls=0;const pauses=[],results=[];
 await runLoop({signal:controller.signal,run:async()=>{calls++;if(calls===1)throw Error('offline');return {status:calls===2?'done':'daily_limit'};},report:r=>results.push(r.status),pause:async ms=>{pauses.push(ms);if(calls===3)controller.abort();}});
 assert.deepEqual(results,['connection-error','done','daily_limit']);assert.deepEqual(pauses,[30000,1000,300000]);
});
