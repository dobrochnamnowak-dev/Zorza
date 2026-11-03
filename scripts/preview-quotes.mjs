// Pobranie publicznych cen bez dostępu do danych portfela i bez AI.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fetchQuotes} from '../lib/quotes.mjs';
const report=await fetchQuotes({onProgress:(done,total)=>{if(done%10===0)console.log(`Notowania ${done}/${total}`);}});
const dir=new URL('../reports/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL('quotes-preview.json',dir),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({downloaded:report.quotes.length,errors:report.errors.length,stopped:report.stopped}));
