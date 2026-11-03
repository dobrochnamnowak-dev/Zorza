import test from 'node:test';
import assert from 'node:assert/strict';
import {researchArticle,researchQueries} from '../lib/article-research.mjs';
const article={instrument_name:'AMD',title:'AMD announces quarterly results - Publisher',url:'https://example.com/original',private_note:'never-send'};
const rss=items=>'<rss><channel>'+items+'</channel></rss>';
const item=(title,url,date='Tue, 03 Nov 2026 08:00:00 GMT')=>`<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description>Publiczny fragment</description><source>Wydawca</source></item>`;
test('wyszukiwanie używa tylko publicznej nazwy i nagłówka, nie prywatnych danych',()=>{
 const queries=researchQueries(article);assert.ok(queries.every(q=>q.includes('AMD')&&q.endsWith('when:90d')&&!q.includes('never-send')));
});
test('wyniki zawierają daty źródła, bez duplikatów i pierwotnego artykułu',async()=>{
 let calls=0;const report=await researchArticle(article,{now:new Date('2026-11-03T12:00:00Z'),fetcher:async url=>{calls++;assert.equal(new URL(url).hostname,'news.google.com');return new Response(rss(item('Inny tekst','https://example.com/other')+item('Inny tekst','https://example.com/other')+item('Oryginał',article.url)+item('Przyszły','https://example.com/future','Wed, 04 Nov 2026 12:00:00 GMT')));}});
 assert.equal(calls,1);assert.equal(report.results.length,1);assert.equal(report.results[0].published_at,'2026-11-03T08:00:00.000Z');
});
test('puste wyszukiwanie sprawdza najwyżej dwa warianty; blokady nie są obchodzone',async()=>{
 let calls=0;const result=await researchArticle(article,{fetcher:async()=>{calls++;return new Response(rss(''));}});assert.ok(calls<=2);assert.deepEqual(result.results,[]);
 calls=0;await assert.rejects(()=>researchArticle(article,{fetcher:async()=>{calls++;return new Response('',{status:403});}}),/403/);assert.equal(calls,1);
});
