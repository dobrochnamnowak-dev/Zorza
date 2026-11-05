import {boundedFetch} from './collector.mjs';
import {extractArticleText} from './article-content.mjs';
import {articleText} from './article-text.mjs';

export function createArticleReader(store,{fetcher=fetch,now=()=>new Date()}={}){
 const db=store.db,inflight=new Map(),articles=new Map();
 db.exec('CREATE TABLE IF NOT EXISTS article_page_cache(url TEXT PRIMARY KEY,etag TEXT,modified TEXT,content_text TEXT NOT NULL,checked_at TEXT NOT NULL)');
 async function readPage(url){
  if(inflight.has(url))return inflight.get(url);
  const job=(async()=>{
   const old=db.prepare('SELECT * FROM article_page_cache WHERE url=?').get(url),headers={Accept:'text/html'};
   if(old?.etag)headers['If-None-Match']=old.etag;if(old?.modified)headers['If-Modified-Since']=old.modified;
   try{
    const {response,text}=await boundedFetch(url,headers,fetcher);
    if(response.status===304&&!old)throw Error('Brak treści do odpowiedzi 304');
    const content=response.status===304?old.content_text:extractArticleText(text);
    if(/\bno-store\b/i.test(response.headers.get('cache-control')||'')){
     db.prepare('DELETE FROM article_page_cache WHERE url=?').run(url);inflight.delete(url);
    }else{
     db.prepare('INSERT INTO article_page_cache(url,etag,modified,content_text,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET etag=excluded.etag,modified=excluded.modified,content_text=excluded.content_text,checked_at=excluded.checked_at').run(url,response.headers.get('etag')||(response.status===304?old.etag:null),response.headers.get('last-modified')||(response.status===304?old.modified:null),content,now().toISOString());
    }
    return content;
   }catch(error){db.prepare('DELETE FROM article_page_cache WHERE url=?').run(url);throw error;}
  })();
  inflight.set(url,job);return job;
 }
 return {readPage,read(article,instrument){
  // Domain checks remain instrument-specific even when the public page is shared.
  const key=JSON.stringify([article.url,article.content_hash,instrument.id,article.publisher_url]);
  if(!articles.has(key))articles.set(key,articleText(article,instrument,{fetcher,readPage}));
  return articles.get(key);
 }};
}

export function createArticleReaderPool(store,{fetcher=fetch}={}){
 const scopes=new Map();return {forSlot(slot){if(!scopes.has(slot)){scopes.set(slot,createArticleReader(store,{fetcher}));while(scopes.size>4)scopes.delete(scopes.keys().next().value);}return scopes.get(slot);}};
}
