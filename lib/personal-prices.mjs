import {included,personalPriceSlot} from './settings.mjs';
import {collectQuotes} from './quotes.mjs';

export async function collectScheduledPersonalPrices(store,{now=new Date(),fetcher=fetch}={}){
 const slot=personalPriceSlot(now),key='personal_prices_slot';
 if(!slot||store.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value===slot)return {status:'not_due'};
 const instrumentIds=included(store.db,'both');
 if(!instrumentIds.length)return {status:'empty'};
 const result=await collectQuotes(store,{instrumentIds,reportKey:'quotes_focus_report',fetcher});
 if(result.busy)return {status:'busy'};
 store.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,slot);
 return {status:'done',slot,...result};
}
