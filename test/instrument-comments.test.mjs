import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStore} from '../lib/store.mjs';
const catalog={items:[{id:'a',name_on_screenshot:'A',type:'stock',working_group:'energia'},{id:'b',name_on_screenshot:'B',type:'etf',working_group:'energia'}]};
test('komentarze są trwałe i przypisane do właściwego podmiotu',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zorza-comments-')),path=join(dir,'test.sqlite');let s=createStore(path,catalog);
 try{const id=s.addComment('a','  Moja uwaga\nDruga linia  ');s.db.close();s=createStore(path,catalog);assert.equal(s.commentsForInstrument('a')[0].text,'Moja uwaga\nDruga linia');assert.equal(s.commentsForInstrument('b').length,0);s.deleteComment('b',id);assert.equal(s.commentsForInstrument('a').length,1);s.deleteComment('a',id);assert.equal(s.commentsForInstrument('a').length,0);}finally{s.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('odrzuca pusty, zbyt długi komentarz oraz nieznany podmiot',()=>{const s=createStore(':memory:',catalog);try{for(const text of ['', '   ',null,'a'.repeat(5001)])assert.throws(()=>s.addComment('a',text));assert.throws(()=>s.addComment('missing','tekst'));assert.equal(s.commentsForInstrument('a').length,0);}finally{s.db.close();}});
