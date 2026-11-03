import {request} from 'node:http';

// Unix socket is mounted only into the web backend, never into the Codex container.
export function deploymentRequest(action,input={},socketPath=process.env.DEPLOY_SOCKET){
 if(!['status','prepare','deploy'].includes(action))throw Error('Nieznana operacja wdrożenia');
 if(!socketPath)return Promise.resolve({enabled:false,phase:'unavailable',message:'Wdrażanie backendu nie jest jeszcze włączone.'});
 return new Promise((resolve,reject)=>{
  const payload=JSON.stringify(action==='deploy'?{id:input.id}:{});
  const req=request({socketPath,path:'/'+action,method:action==='status'?'GET':'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)},timeout:10000},res=>{
   let data='';res.on('data',chunk=>{data+=chunk;if(data.length>1000000)res.destroy();});
   res.on('end',()=>{try{const value=JSON.parse(data);if(res.statusCode>=400)throw Object.assign(Error(value.error||'Nie można wdrożyć wersji'),{status:res.statusCode});resolve(value);}catch(e){reject(e);}});
   res.on('error',()=>reject(Object.assign(Error('Brak połączenia z wdrażaniem'),{status:503})));
  });
  req.on('timeout',()=>req.destroy());req.on('error',()=>reject(Object.assign(Error('Wdrażanie jest chwilowo niedostępne'),{status:503})));req.end(payload);
 });
}
