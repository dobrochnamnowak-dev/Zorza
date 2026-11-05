import {clean} from './core.mjs';

export function extractArticleText(html){
 if(/"isAccessibleForFree"\s*:\s*(false|"false")/i.test(html))return '';
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const values=[JSON.parse(match[1])];while(values.length){const value=values.shift();if(Array.isArray(value)){values.push(...value);continue;}if(!value||typeof value!=='object')continue;if(typeof value.articleBody==='string')return clean(value.articleBody).slice(0,14000);if(value['@graph'])values.push(value['@graph']);}}catch{}
 }
 const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
 if(!article)return '';
 return clean(article.replace(/<(nav|header|footer|aside|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')).slice(0,14000);
}
