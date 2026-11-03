import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationSlot, priceSlot, getSettings, saveSettings, included } from '../lib/settings.mjs';
import { createStore } from '../lib/store.mjs';
test('harmonogram ma dokładne granice 15:40 i 21:45 w polskiej strefie, także po zmianie czasu',()=>{
 assert.equal(publicationSlot('daily',new Date('2026-11-03T14:39:59Z')),null);
 assert.equal(publicationSlot('daily',new Date('2026-11-03T14:40:00Z')),'2026-11-03/15:40');
 assert.equal(publicationSlot('daily',new Date('2026-11-03T20:45:00Z')),'2026-11-03/15:40');
 assert.equal(priceSlot('twice_daily',new Date('2026-11-03T20:44:59Z')),'2026-11-03/15:40');
 assert.equal(priceSlot('twice_daily',new Date('2026-11-03T20:45:00Z')),'2026-11-03/21:45');
 assert.equal(priceSlot('twice_daily',new Date('2026-07-02T13:40:00Z')),'2026-07-02/15:40');
 assert.equal(priceSlot('twice_daily',new Date('2026-07-02T19:45:00Z')),'2026-07-02/21:45');
 assert.equal(priceSlot('twice_daily',new Date('2026-03-29T13:40:00Z')),'2026-03-29/15:40');
 assert.equal(priceSlot('twice_daily',new Date('2026-10-25T14:40:00Z')),'2026-10-25/15:40');
 assert.equal(priceSlot('twice_daily',new Date('2026-11-07T14:40:00Z')),'2026-11-07/15:40');
 assert.equal(publicationSlot('twice_weekly',new Date('2026-11-02T14:40:00Z')),null);
 assert.equal(publicationSlot('twice_weekly',new Date('2026-11-03T14:40:00Z')),'2026-11-03/15:40');
});
test('kupione i obserwowane są niezależne, a ustawienia trwałe i walidowane',t=>{
 const s=createStore(':memory:',{items:[1,2,3].map(n=>({id:`AKCJA-00${n}`,name_on_screenshot:'Test',type:'stock',working_group:'test'}))});t.after(()=>s.db.close());
 s.db.prepare("INSERT INTO purchases VALUES('test','AKCJA-001',1,100,'USD','2026-11-02','2026-11-02')").run();
 s.db.prepare("UPDATE instruments SET watched=1 WHERE id='AKCJA-002'").run();
 assert.deepEqual(included(s.db,'bought'),['AKCJA-001']);assert.deepEqual(included(s.db,'watched'),['AKCJA-002']);assert.equal(included(s.db,'both').length,2);
 assert.equal(included(s.db,'all').length,3);
 saveSettings(s.db,{scope:'all'});assert.equal(getSettings(s.db).scope,'all');
 saveSettings(s.db,{pricesFrequency:'twice_weekly'});assert.equal(getSettings(s.db).pricesFrequency,'twice_weekly');assert.throws(()=>saveSettings(s.db,{reminderDays:100}));
});
