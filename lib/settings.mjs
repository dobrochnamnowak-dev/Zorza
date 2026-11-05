export const defaults={pricesFrequency:'daily',publicationsFrequency:'daily',scope:'both',reminderDays:1,reminderHour:9,insightsScope:'personal'};
export function getSettings(db){const row=db.prepare("SELECT value FROM meta WHERE key='preferences'").get();return {...defaults,...(row?JSON.parse(row.value):{})};}
export function saveSettings(db,value){
 if(!value||Object.keys(value).some(k=>!(k in defaults)))throw new Error('Nieznane ustawienie');
 const next={...getSettings(db),...value};
 for(const k of ['pricesFrequency','publicationsFrequency'])if(!['daily','twice_daily','twice_weekly'].includes(next[k]))throw new Error('Nieprawidłowa częstotliwość');
 if(!['all','both','bought','watched'].includes(next.scope)||![0,1,3,7].includes(next.reminderDays)||!Number.isInteger(next.reminderHour)||next.reminderHour<0||next.reminderHour>23)throw new Error('Nieprawidłowe ustawienia');
 if(!['disabled','personal'].includes(next.insightsScope))throw new Error('Nieprawidłowy zakres opisów');
 db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('preferences',?)").run(JSON.stringify(next));return next;
}
export function included(db,scope){return db.prepare(`SELECT id FROM instruments i WHERE ${scope==='all'?'1=1':scope==='bought'?'EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id)':scope==='watched'?'i.watched=1':'(i.watched=1 OR EXISTS(SELECT 1 FROM purchases p WHERE p.instrument_id=i.id))'}`).all().map(x=>x.id);}
// Jedna strefa czasu i te same pory pobrań, niezależnie od zegara serwera.
function dataSlot(frequency,now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(p=>[p.type,p.value]));
 if(frequency==='twice_weekly'&&!['Tue','Fri'].includes(parts.weekday))return null;
 const minute=Number(parts.hour)*60+Number(parts.minute);
 const slot=frequency==='twice_daily'&&minute>=21*60+45?'21:45':minute>=15*60+40?'15:40':null;
 return slot?`${parts.year}-${parts.month}-${parts.day}/${slot}`:null;
}
export function publicationSlot(frequency,now=new Date()){return dataSlot(frequency,now);}
export function priceSlot(frequency,now=new Date()){return dataSlot(frequency,now);}
export function personalPriceSlot(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return Number(p.hour)*60+Number(p.minute)>=18*60+30?`${p.year}-${p.month}-${p.day}/18:30`:null;
}
