import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function runOnce(){return {status:'disabled'};}
export async function runLoop({run,signal,pause=ms=>new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});}),report=()=>{},interval=30000}){
 while(!signal?.aborted){
  let result;try{result=await run();report(result);}catch{result={status:'connection-error'};report(result);}
  if(signal?.aborted)break;
  await pause(result.status==='done'?1000:result.status==='daily_limit'?300000:Math.max(1000,interval));
 }
}
async function main(){console.log('Osobne podsumowania artykułów są wyłączone. Dostępny jest brief.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
