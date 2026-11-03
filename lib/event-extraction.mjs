import {clean,digest,isoNow,validDay} from './core.mjs';
const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const month='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember|t)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const definitions=[
 ['report',/annual report|interim report|quarterly report|half.year report|10-K|10-Q|20-F/i,'Publikacja sprawozdania'],
 ['earnings',/earnings|financial results|quarterly results|quarter results|year.end results/i,'Publikacja wyników finansowych'],
 ['distribution',/dividend|distribution|record date|payment date/i,'Dywidenda / dystrybucja'],
 ['meeting',/conference call|webcast|investor day|investor meeting|capital markets day|general meeting|shareholder meeting/i,'Konferencja lub spotkanie inwestorów'],
 ['fund',/rebalance|index review|fund notice|fund merger|fund liquidation|fund termination/i,'Zapowiedziane działanie funduszu']
];
const future=/will|scheduled|schedules|to (?:report|publish|announce|release|hold|present)|plans? to|set for|upcoming|conference call|webcast|investor day|investor meeting|capital markets day|general meeting|shareholder meeting|ex-dividend|record date|payment date|rebalance|fund liquidation|fund termination/i;
const localDay=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function extractEventDates(article,now=new Date()){
 const text=clean((article.title||'')+' '+(article.excerpt||''));const found=[];
 const add=(m,year,month,day)=>found.push({start:m.index,end:m.index+m[0].length,year:year?Number(year):null,month:Number(month),day:Number(day)});
 for(const m of text.matchAll(new RegExp('\\b('+month+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b','gi')))add(m,m[3],months[m[1].slice(0,3).toLowerCase()],m[2]);
 for(const m of text.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+('+month+')(?:,?\\s+(20\\d{2}))?\\b','gi')))add(m,m[3],months[m[2].slice(0,3).toLowerCase()],m[1]);
 for(const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g))add(m,m[1],m[2],m[3]);
 for(const m of text.matchAll(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/g))add(m,m[3],m[2],m[1]);
 found.sort((a,b)=>a.start-b.start);
 const result=[],today=localDay(now),published=(article.published_at||today).slice(0,10);let previousEnd=0;
 for(const d of found){
  const start=Math.max(previousEnd,d.start-190),before=text.slice(start,d.start),after=text.slice(d.end,d.end+80);previousEnd=d.end;
  const kind=definitions.map(definition=>{const matches=[...before.matchAll(new RegExp(definition[1].source,'gi'))];const last=matches.at(-1);return {definition,end:last?last.index+last[0].length:-1};}).filter(k=>k.end>=0).sort((a,b)=>b.end-a.end)[0]?.definition;if(!kind||!future.test(before))continue;
  if(/(?:ended|ending|as of|dated|published|issued)\s*$/i.test(before)||/^\s*(?:[—–]|--|\((?:GLOBE|BUSINESS|PRNewswire))/i.test(after))continue;
  let year=d.year||Number(published.slice(0,4));let date=`${year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
  if(!d.year&&date<published){year++;date=year+date.slice(4);}
  if(!validDay(date)||date<today||Date.parse(date)-Date.parse(today)>400*86400000||(!d.year&&Date.parse(date)-Date.parse(published)>200*86400000))continue;
  const event={date,title:kind[2],kind:kind[0],certainty:d.year&&article.publication_kind==='press'?'confirmed':'estimated',evidence:text.slice(start,Math.min(text.length,d.end+20)).slice(-230)};
  if(!result.some(e=>e.date===date&&e.kind===event.kind))result.push(event);
 }
 return result.slice(0,8);
}
export function saveEventDates(store,article,now=new Date()){
 if(!article.eligible||article.deleted_at)return 0;
 const saved=store.db.prepare('SELECT eligible,deleted_at FROM articles WHERE id=?').get(article.id);
 if(!saved?.eligible||saved.deleted_at)return 0;
 const events=extractEventDates(article,now);
 for(const date of new Set(events.map(e=>e.date))){const kinds=events.filter(e=>e.date===date).map(e=>e.kind);store.db.prepare(`UPDATE events SET review_status='outdated' WHERE article_id=? AND event_date=? AND id LIKE 'auto-%' AND event_kind NOT IN(${kinds.map(()=>'?').join(',')}) AND review_status='approved'`).run(article.id,date,...kinds);}
 for(const e of events){const id='auto-'+digest(article.instrument_id+'|'+e.kind+'|'+e.date);
  store.db.prepare(`INSERT INTO events(id,article_id,title,event_date,certainty,evidence,review_status,created_at,event_kind,source_url) VALUES(?,?,?,?,?,?,'approved',?,?,?) ON CONFLICT(id) DO UPDATE SET article_id=CASE WHEN excluded.certainty='confirmed' THEN excluded.article_id ELSE events.article_id END,certainty=CASE WHEN excluded.certainty='confirmed' THEN 'confirmed' ELSE events.certainty END,review_status=CASE WHEN events.review_status='rejected' THEN 'rejected' ELSE 'approved' END`).run(id,article.id,e.title,e.date,e.certainty,e.evidence,isoNow(),e.kind,article.source_url||article.url);
 }
 return events.length;
}
