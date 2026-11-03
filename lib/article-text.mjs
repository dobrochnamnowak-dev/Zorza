import {clean} from './core.mjs';
import {allowedDomain,publicationProfile,domainOf} from './publication-policy.mjs';
import {boundedFetch} from './collector.mjs';

export function extractArticleText(html){
 if(/"isAccessibleForFree"\s*:\s*(false|"false")/i.test(html))return '';
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const values=[JSON.parse(match[1])];while(values.length){const value=values.shift();if(Array.isArray(value)){values.push(...value);continue;}if(!value||typeof value!=='object')continue;if(typeof value.articleBody==='string')return clean(value.articleBody).slice(0,14000);if(value['@graph'])values.push(value['@graph']);}}catch{}
 }
 const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
 if(!article)return '';
 return clean(article.replace(/<(nav|header|footer|aside|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')).slice(0,14000);
}
export async function articleText(article,instrument,{fetcher=fetch}={}){
 const profile=publicationProfile(instrument),publisher=domainOf(article.publisher_url),domains=[...profile.domains,...(publisher?[publisher]:[])];
 let url=article.url;
 try{
  if(new URL(url).hostname==='news.google.com'){
   const {text}=await boundedFetch(url,{'Accept':'text/html'},fetcher);
   const links=[...text.matchAll(/(?:href|content)=["'](https:\/\/[^"'<>]+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&'));
   url=links.find(link=>allowedDomain(link,domains)&&new URL(link).pathname.length>3);
  }
  if(url&&allowedDomain(url,domains)){
   const {text}=await boundedFetch(url,{'Accept':'text/html'},fetcher);
   const content=extractArticleText(text);if(content.length>250)return {text:content,basis:'article',url};
  }
 }catch{}
 const excerpt=clean(article.excerpt||'');
 return {text:excerpt,basis:excerpt.length>article.title.length+100?'excerpt':'headline',url:article.url};
}
