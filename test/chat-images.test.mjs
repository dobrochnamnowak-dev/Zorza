import test from 'node:test';
import assert from 'node:assert/strict';
import {chatImages,CHAT_BODY_LIMIT} from '../scripts/chat-images.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=';
test('zdjęcia są opcjonalne, a poprawne załączniki pozostają bez zmian',()=>{
 assert.deepEqual(chatImages(),[]);assert.deepEqual(chatImages([png]),[png]);
 assert.equal(chatImages([png,png,png]).length,3);assert.ok(CHAT_BODY_LIMIT>3*1400000);
});
test('odrzuca nadmiar zdjęć, URL, HTML, fałszywy MIME i przekroczony limit',()=>{
 for(const value of [[png,png,png,png],{},['https://example.com/a.png'],['data:text/html;base64,PHNjcmlwdD4='],['data:image/jpeg;base64,aGVsbG8='],[png.replace('/png','/jpeg')],['data:image/png;base64,'+'A'.repeat(1400000)]])assert.throws(()=>chatImages(value));
});
test('screeny znikają z historii Zorzy dopiero po poprawnej odpowiedzi',async()=>{
 const {finishScreenshotMessage}=await import('../scripts/chat-images.mjs');const messages=[{id:'screen',role:'user',images:[png],deleteImagesAfterReply:true,screenshot_status:'running'},{id:'answer',role:'assistant',text:'Podsumowanie z dostarczonych screenów.'},{id:'normal',role:'user',images:[png]}];
 assert.equal(finishScreenshotMessage(messages,{messageId:'screen',assistantId:'answer',status:'completed'}),true);assert.equal(messages[0].images,undefined);assert.equal(messages[0].screenshot_status,'done');assert.ok(messages[0].images_removed_at);assert.deepEqual(messages[2].images,[png]);
});
test('błąd, przerwanie lub pusta odpowiedź nie usuwa screenów potrzebnych do ponowienia',async()=>{
 const {finishScreenshotMessage}=await import('../scripts/chat-images.mjs');for(const status of ['failed','interrupted','completed']){const messages=[{id:'screen',role:'user',images:[png],deleteImagesAfterReply:true},{id:'answer',role:'assistant',text:''}];assert.equal(finishScreenshotMessage(messages,{messageId:'screen',assistantId:'answer',status}),false);assert.deepEqual(messages[0].images,[png]);assert.equal(messages[0].screenshot_status,'failed');}
});
