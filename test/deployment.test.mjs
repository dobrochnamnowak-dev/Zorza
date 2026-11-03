import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deploymentRequest} from '../lib/deployment.mjs';

test('bez kontrolera wdrażanie jest wyłączone i nie wykonuje poleceń',async()=>{
 assert.deepEqual(await deploymentRequest('status',{},''),{enabled:false,phase:'unavailable',message:'Wdrażanie backendu nie jest jeszcze włączone.'});
 assert.throws(()=>deploymentRequest('shell',{},''),/Nieznana/);
});

test('klient wdrożenia używa prywatnego gniazda i przesyła wyłącznie identyfikator wersji',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'zorza-deploy-')),socket=join(directory,'control.sock');
 const received=[];
 const server=createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;received.push({method:req.method,path:req.url,body:JSON.parse(text)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({phase:req.url==='/deploy'?'deploying':'ready'}));});
 await new Promise(resolve=>server.listen(socket,resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
 assert.equal((await deploymentRequest('status',{},socket)).phase,'ready');
 assert.equal((await deploymentRequest('deploy',{id:'abc',command:'untrusted'},socket)).phase,'deploying');
 assert.deepEqual(received,[{method:'GET',path:'/status',body:{}},{method:'POST',path:'/deploy',body:{id:'abc'}}]);
});
