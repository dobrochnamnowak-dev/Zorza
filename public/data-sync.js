import {mergeQuotes} from './portfolio.js?v=original-headlines1';

export function mergeChatSnapshot(previous={cursor:null,messages:[]},result){
 const sync=result.sync;
 if(!sync)return {cursor:null,messages:result.messages||[]};
 if(sync.version!==1||!Array.isArray(sync.order)||!Array.isArray(sync.messages)||typeof sync.cursor!=='string')throw Error('Niepoprawna synchronizacja czatu');
 const messages=new Map((sync.reset?[]:previous.messages).map(m=>[m.id,m]));
 for(const m of sync.messages)messages.set(m.id,m);
 if(sync.order.some(id=>!messages.has(id)))throw Error('Niekompletna historia czatu');
 return {cursor:sync.cursor,messages:sync.order.map(id=>messages.get(id))};
}
export function mergeDashboard(previous,next){
 const merged={...next,quotes:mergeQuotes(previous?.quotes,next.quotes)};
 for(const key of next.omitted||[])merged[key]=previous?.[key]||[];
 if(next.insight_summaries){
  merged.insights=Object.fromEntries(Object.entries(next.insights).map(([id,n])=>{
   const old=previous?.insights?.[id];return [id,old?.material_hash&&old.material_hash===n.material_hash&&!n.stale?{...old,...n}:n];
  }));
 }
 return merged;
}
