import {clean} from './core.mjs';
import {allowedDomain,publicationProfile,domainOf} from './publication-policy.mjs';
import {boundedFetch} from './collector.mjs';

import {extractArticleText} from './article-content.mjs';
export {extractArticleText} from './article-content.mjs';
export async function articleText(article,instrument,{fetcher=fetch,readPage=null}={}){
 const profile=publicationProfile(instrument),publisher=domainOf(article.publisher_url),domains=[...profile.domains,...(publisher?[publisher]:[])];
 let url=article.url;
 try{
  if(new URL(url).hostname==='news.google.com'){
   const {text}=await boundedFetch(url,{'Accept':'text/html'},fetcher);
   const links=[...text.matchAll(/(?:href|content)=["'](https:\/\/[^"'<>]+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&'));
   url=links.find(link=>allowedDomain(link,domains)&&new URL(link).pathname.length>3);
  }
  if(url&&allowedDomain(url,domains)){
   const content=readPage?await readPage(url):extractArticleText((await boundedFetch(url,{'Accept':'text/html'},fetcher)).text);if(content.length>250)return {text:content,basis:'article',url};
  }
 }catch{}
 const excerpt=clean(article.excerpt||'');
 return {text:excerpt,basis:excerpt.length>article.title.length+100?'excerpt':'headline',url:article.url};
}
