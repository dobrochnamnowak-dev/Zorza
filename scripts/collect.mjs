import { openStore } from '../lib/store.mjs';
import { collect } from '../lib/collector.mjs';
const store=openStore();
try {console.log(JSON.stringify(await collect(store)));}finally{store.db.close();}
