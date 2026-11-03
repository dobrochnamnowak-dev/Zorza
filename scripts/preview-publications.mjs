// Publiczny podgląd RSS, bez bazy użytkowniczki i bez uruchamiania AI.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {parseRss,publicationSince} from '../lib/core.mjs';
import {boundedFetch} from '../lib/collector.mjs';
const sources=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url),'utf8'));
const now=new Date(),since=publicationSince(now);
const report={since,checked_at:now.toISOString(),scope:'Nagłówki i fragmenty RSS, bez pełnych tekstów i bez tłumaczenia AI',sources:[]};
let cursor=0,done=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<sources.length){const source=sources[cursor++];let entry;
  try{const {text}=await boundedFetch(source.url,{'User-Agent':'ZorzaRSSReader/0.1','Accept':'application/rss+xml,application/xml,text/xml'});const parsed=parseRss(text);const articles=parsed.filter(a=>a.published_at&&a.published_at>=since&&a.published_at<=now.toISOString());entry={id:source.id,instrument_id:source.instrument_id,name:source.name,status:articles.length?'ok':'empty',articles};}
  catch(error){entry={id:source.id,instrument_id:source.instrument_id,name:source.name,status:'error',error:error.message,articles:[]};}
  report.sources.push(entry);done++;if(done%10===0)console.log(`Sprawdzono ${done}/${sources.length}`);
 }
}));
report.sources.sort((a,b)=>a.id.localeCompare(b.id));
const dir=new URL('../reports/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL('publications-preview.json',dir),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({sources:report.sources.length,ok:report.sources.filter(s=>s.status==='ok').length,empty:report.sources.filter(s=>s.status==='empty').length,errors:report.sources.filter(s=>s.status==='error').length,articles:report.sources.reduce((n,s)=>n+s.articles.length,0)}));
