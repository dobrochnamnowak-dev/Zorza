import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// Dane konfiguracyjne jako JSON na stdin, nigdy hasło w argumentach polecenia.
let text='';for await(const c of process.stdin){text+=c;if(text.length>10000)throw new Error('Za duże dane');}
const input=JSON.parse(text);
if(typeof input.password!=='string'||input.password.length<12)throw new Error('Hasło wymaga co najmniej 12 znaków');
if(!/^https:\/\/[^/]+$/.test(input.origin)||!input.dataDir?.startsWith('/')||!input.output?.startsWith('/'))throw new Error('Podaj origin HTTPS bez ścieżki i absolutne ścieżki');
const salt=randomBytes(16).toString('hex'),hash=scryptSync(input.password,salt,32).toString('hex');
const config={NODE_ENV:'production',APP_ORIGIN:input.origin,PORT:'3000',DATA_DIR:input.dataDir,APP_PASSWORD_HASH:`${salt}:${hash}`,WORKER_TOKEN:randomBytes(32).toString('hex'),AI_AUTOMATION_ENABLED:'0',MAX_AI_RUNS_PER_DAY:'3',COLLECT_INTERVAL_MINUTES:'360',CODEX_RUN_ENABLED:'0'};
mkdirSync(dirname(input.output),{recursive:true,mode:0o700});
writeFileSync(resolve(input.output),Object.entries(config).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log('Zapisano prywatny plik konfiguracji. AI pozostaje wyłączone.');
