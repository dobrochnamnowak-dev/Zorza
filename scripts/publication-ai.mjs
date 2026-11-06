import {execFile} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {insightSchema,insightPrompt,validateInsightTask} from './insight-ai.mjs';

export function publicationPrompt(task){
 if(task.kind==='summary')throw Error('Osobne podsumowania artykułów są wyłączone');
 if(task.kind==='titles')throw Error('Tłumaczenie nagłówków jest wyłączone');
 if(task.kind!=='insight')throw Error('Niepoprawny rodzaj zadania');
 return insightPrompt(task);
}
export const insightModel='gpt-6.1-sol';
export function publicationModelFor(kind){
 if(kind!=='insight')throw Error('Niepoprawny rodzaj zadania');
 return insightModel;
}
export async function runPublicationAI(task,{bin='codex',env=process.env}={}){
 if(task.kind==='summary')throw Error('Osobne podsumowania artykułów są wyłączone');
 if(task.kind==='titles')throw Error('Tłumaczenie nagłówków jest wyłączone');
 if(task.kind!=='insight')throw Error('Niepoprawny rodzaj zadania');
 validateInsightTask(task);
 const dir=await mkdtemp(join(tmpdir(),'zorza-publication-'));
 const childEnv=Object.fromEntries(['HOME','PATH','LANG','TMPDIR','CODEX_HOME'].filter(k=>env[k]).map(k=>[k,env[k]]));
 try{
  await writeFile(join(dir,'schema.json'),JSON.stringify(insightSchema));
  const args=['exec','--model',publicationModelFor(task.kind),'-c','model_reasoning_effort="low"','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--disable','shell_tool','--disable','apps','-c','web_search="disabled"','-C',dir,'--output-schema',join(dir,'schema.json'),'-o',join(dir,'result.json'),'-'];
  await new Promise((resolve,reject)=>{const child=execFile(bin,args,{env:childEnv,timeout:150000,maxBuffer:1500000},error=>error?reject(Error('Codex nie zakończył opracowania. Sprawdź połączenie lub limit konta.')):resolve());child.stdin.on('error',()=>{});child.stdin.end(publicationPrompt(task));});
  const result=JSON.parse(await readFile(join(dir,'result.json'),'utf8'));
  return result;
 }finally{await rm(dir,{recursive:true,force:true});}
}
