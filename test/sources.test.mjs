import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sources=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url),'utf8'));
test('kanały odpowiadają katalogowi i nie przypisują źródeł niejednoznacznym instrumentom',()=>{
 assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
 for(const source of sources){const item=catalog.items.find(i=>i.id===source.instrument_id);assert.ok(item);assert.equal(new URL(source.url).protocol,'https:');assert.ok(!/do weryfikacji/.test(item.working_group));}
});
test('wyszukiwanie RSS ma ograniczenie miesiąca i jawne oznaczenie nagłówków',()=>{
 for(const source of sources.filter(s=>s.id.startsWith('foreign-news-'))){const url=new URL(source.url);assert.equal(url.hostname,'news.google.com');assert.equal(url.pathname,'/rss/search');assert.ok(url.searchParams.get('q').endsWith(' when:30d'));assert.equal(url.searchParams.get('hl'),'en-US');assert.equal(url.searchParams.get('gl'),'US');assert.ok(url.searchParams.get('q').includes('site:reuters.com'));assert.ok(source.policy.domains.every(d=>!d.endsWith('.pl')));}
});
