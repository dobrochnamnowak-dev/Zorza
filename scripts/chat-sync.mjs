import {createHash,randomUUID} from 'node:crypto';

// A process epoch forces a full reset after restart, never an incomplete replay.
export function createChatSync(){
 const epoch=randomUUID(),legacy=new WeakMap();let dirty=true,revision=0,current=new Map();
 const idFor=m=>{if(m.id)return m.id;if(!legacy.has(m))legacy.set(m,'legacy-'+randomUUID());return legacy.get(m);};
 return {
  touch(){dirty=true;},
  snapshot(messages,cursor=null){
   if(dirty){
    const next=new Map(),previousOrder=[...current.keys()];let changed=current.size!==messages.length;
    for(const [index,message] of messages.entries()){const id=idFor(message);if(previousOrder[index]!==id)changed=true;const value={...message,id},hash=createHash('sha256').update(JSON.stringify(value)).digest('hex'),old=current.get(id);if(!old||old.hash!==hash)changed=true;next.set(id,{value,hash,version:old?.hash===hash?old.version:revision+1});}
    if(changed)revision++;current=next;dirty=false;
   }
   const prefix=epoch+':',since=typeof cursor==='string'&&cursor.startsWith(prefix)&&/^\d+$/.test(cursor.slice(prefix.length))?Number(cursor.slice(prefix.length)):null;
   // A delta client receives the current order, so deletions never accumulate.
   const reset=since===null||!Number.isSafeInteger(since)||since>revision;
   return {version:1,cursor:prefix+revision,reset,order:[...current.keys()],messages:[...current.values()].filter(m=>reset||m.version>since).map(m=>m.value)};
  }
 };
}
