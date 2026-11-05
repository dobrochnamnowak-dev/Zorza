import test from 'node:test';
import assert from 'node:assert/strict';
import {validEventWindow,extractEventWindows,saveInsightDates} from '../lib/event-windows.mjs';
import {createStore} from '../lib/store.mjs';
import {eventDateLabel} from '../public/company-insights.js';
const now=new Date('2026-11-04T12:00:00Z');
test('terminy częściowe zachowują rzeczywistą precyzję bez wymyślania dnia',()=>{
 const half={date:'2028-01-01',end_date:'2028-06-30',precision:'half'};
 assert.equal(validEventWindow(half),true);assert.equal(eventDateLabel(half),'I półrocze 2028');
 assert.equal(validEventWindow({...half,end_date:'2028-05-31'}),false);
 const month={date:'2027-01-01',end_date:'2027-01-31',precision:'month'};
 assert.equal(validEventWindow(month),true);assert.match(eventDateLabel(month),/styczeń 2027/);
 const a={title:'Transaction update',excerpt:'The transaction is expected to close in the first half of calendar year 2028. Deliveries are expected to start in calendar 2027.'};
 assert.deepEqual(extractEventWindows(a,now).map(e=>e.precision),['half','year']);
 assert.equal(extractEventWindows({title:'Results for first quarter fiscal 2027',excerpt:'The company reported revenue of $1 billion.'},now).length,0);
});
test('zapis opisu dodaje źródłowe terminy do kalendarza, bez duplikatów i przywracania odrzuconych',()=>{
 const s=createStore(':memory:',{items:[{id:'X',name_on_screenshot:'Spółka',type:'stock',working_group:'technologia'}]});
 try{
 s.db.prepare("INSERT INTO sources(id,instrument_id,name,url) VALUES('S','X','IR','https://example.com/ir')").run();
 s.db.prepare("INSERT INTO articles(id,instrument_id,source_id,title,url,excerpt,published_at,eligible,content_hash) VALUES('A','X','S','Deal','https://example.com/deal','','2026-11-02T12:00:00Z',1,'h')").run();
 const item={text:'Zamknięcie transakcji po uzyskaniu zgód',date:'2028-01-01',end_date:'2028-06-30',precision:'half',certainty:'estimated',sources:['A']};
 const input={articles:[{id:'A',url:'https://example.com/deal'}],events:[{article_id:'A',event_date:item.date,end_date:item.end_date,precision:'half',certainty:'estimated',evidence:'expected to close in the first half of calendar year 2028'}]};
 assert.equal(saveInsightDates(s.db,'X',{situation_dates:[item]},input,now),1);
 saveInsightDates(s.db,'X',{situation_dates:[item]},input,now);
 assert.equal(s.db.prepare('SELECT COUNT(*) n FROM events').get().n,1);
 const row=s.db.prepare('SELECT * FROM events').get();assert.equal(row.date_precision,'half');assert.equal(row.event_end_date,'2028-06-30');
 assert.throws(()=>saveInsightDates(s.db,'X',{situation_dates:[{...item,end_date:'2028-12-31',precision:'year'}]},input,now));
 s.db.prepare("UPDATE events SET review_status='rejected'").run();
 saveInsightDates(s.db,'X',{situation_dates:[item]},input,now);
 assert.equal(s.db.prepare('SELECT review_status FROM events').get().review_status,'rejected');
 }finally{s.db.close();}
});
