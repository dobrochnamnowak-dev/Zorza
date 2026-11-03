import {parseRss,canonicalLink} from './core.mjs';
import {boundedFetch} from './collector.mjs';
export function researchQueries(article){
 // Wysyłamy wyłącznie publiczną nazwę i nagłówek, nigdy dane portfela ani notatki.
 const title=String(article.title||'').replace(/\s[-–—]\s[^–—]+$/,'').replace(/["<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,300);
 const company=String(article.instrument_name||'').replace(/["<>]/g,' ').trim().slice(0,100);
 const terms=title.split(/\s+/).filter(w=>w.length>2&&!/^(the|and|for|with|from|that|this|are|has|its|will|oraz|dla|się|jest)$/i.test(w)).slice(0,6).join(' ');
 return [...new Set([`${company} ${title} when:90d`,`${company} ${terms} when:90d`])];
}
export async function researchArticle(article,{fetcher=fetch,now=new Date()}={}){
 const original=canonicalLink(article.url);let results=[];
 for(const query of researchQueries(article)){
  const url=new URL('https://news.google.com/rss/search');url.search=new URLSearchParams({q:query,hl:'pl',gl:'PL',ceid:'PL:pl'}).toString();
  const {text}=await boundedFetch(url.href,{'Accept':'application/rss+xml,application/xml'},fetcher);
  const seen=new Set();
  results=parseRss(text).filter(item=>{if(item.url===original||seen.has(item.url)||item.title===article.title)return false;if(item.published_at&&Date.parse(item.published_at)>now.getTime())return false;seen.add(item.url);return true;}).slice(0,8);
  if(results.length)break;
 }
 return {checked_at:now.toISOString(),scope:'Google News RSS · inne doniesienia z ostatnich 90 dni · nagłówki i fragmenty',results};
}
