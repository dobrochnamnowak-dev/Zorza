import {clean,validDay,digest} from './core.mjs';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function validEventWindow(e){
 const precision=e.precision||'day';
 if(!validDay(e.date))return false;
 if(precision==='day')return !e.end_date||e.end_date===e.date;
 if(!['month','quarter','half','year'].includes(precision)||!validDay(e.end_date))return false;
 const start=new Date(e.date+'T00:00:00Z'),month=start.getUTCMonth(),length={month:1,quarter:3,half:6,year:12}[precision];
 if(start.getUTCDate()!==1||(precision==='quarter'&&month%3)||(precision==='half'&&month%6)||(precision==='year'&&month!==0))return false;
 const end=new Date(Date.UTC(start.getUTCFullYear(),month+length,0)).toISOString().slice(0,10);
 return e.end_date===end;
}
export function extractEventWindows(article,now=new Date()){
 const text=clean((article.title||'')+' '+(article.excerpt||'')),found=[],today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(now);
 const pattern=new RegExp('\\b(?:in|during|effective(?: date)?(?: in)?|starting(?: in)?)\\s+(?:the\\s+)?('+months.join('|')+'|Q[1-4]|first quarter|second quarter|third quarter|fourth quarter|first half|second half|calendar(?: year)?)\\s+(?:of\\s+)?(?:calendar\\s+)?(?:year\\s+)?(20\\d{2})\\b','gi');
 for(const m of text.matchAll(pattern)){
  const before=text.slice(Math.max(0,m.index-220),m.index),context=before+' '+m[0];
  if(!/will|expected|scheduled|plans?|effective|begin|start|closing|completion/i.test(context)||!/closing|acquisition|merger|transaction|effective|launch|deliver|ship|meeting|conference|dividend|distribution|publish|release/i.test(context))continue;
  const phrase=m[1].toLowerCase(),year=Number(m[2]);let month=months.findIndex(x=>x.toLowerCase()===phrase),precision='month',length=1;
  if(month<0){
   if(/half/.test(phrase)){precision='half';month=phrase.startsWith('first')?0:6;length=6;}
   else if(/calendar/.test(phrase)){precision='year';month=0;length=12;}
   else {precision='quarter';month=phrase.startsWith('q')?(Number(phrase[1])-1)*3:['first quarter','second quarter','third quarter','fourth quarter'].indexOf(phrase)*3;length=3;}
  }
  const date=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10),end_date=new Date(Date.UTC(year,month+length,0)).toISOString().slice(0,10);
  if(end_date<today||year>Number(today.slice(0,4))+4)continue;
  const e={date,end_date,precision,certainty:'estimated',title:article.title||'Zapowiedziane działanie',kind:'corporate',evidence:text.slice(Math.max(0,m.index-220),m.index+m[0].length)};
  if(!found.some(x=>x.date===date&&x.precision===precision))found.push(e);
 }
 return found.slice(0,8);
}
export function saveInsightDates(db,instrumentId,value,input,now=new Date()){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(now);let saved=0;
 for(const item of [...(value.situation_dates||[]),...(value.deadlines||[])]){
  if(!validEventWindow(item)||(item.end_date||item.date)<today)continue;
  const proof=input.events.find(e=>item.sources.includes(e.article_id)&&e.event_date===item.date&&(e.precision||'day')===(item.precision||'day')&&(e.end_date||null)===(item.end_date||null)&&e.certainty===item.certainty);
  if(!proof)throw Error('Brak potwierdzonego źródła terminu');
  const article=input.articles.find(a=>a.id===proof.article_id);if(!article)throw Error('Brak źródła');
  const existing=proof.id&&db.prepare('SELECT e.id FROM events e JOIN articles a ON a.id=e.article_id WHERE e.id=? AND a.instrument_id=?').get(proof.id,instrumentId);
  const id=existing?.id||'insight-date-'+digest(instrumentId+'|'+article.url+'|'+item.text);
  db.prepare(`INSERT INTO events(id,article_id,title,event_date,certainty,evidence,review_status,created_at,event_kind,source_url,date_precision,event_end_date) VALUES(?,?,?,?,?,?,'approved',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,event_date=excluded.event_date,certainty=excluded.certainty,evidence=excluded.evidence,source_url=excluded.source_url,date_precision=excluded.date_precision,event_end_date=excluded.event_end_date,review_status=CASE WHEN events.review_status='rejected' THEN 'rejected' ELSE 'approved' END`).run(id,article.id,item.text,item.date,item.certainty,proof.evidence||'',now.toISOString(),proof.event_kind||'corporate',article.url,item.precision||'day',item.end_date||null);saved++;
 }
 return saved;
}
