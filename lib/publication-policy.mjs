import {issuerDomains} from './issuer-sources.mjs';
import {readFileSync} from 'node:fs';
import {clean,publicLink} from './core.mjs';

const general=['reuters.com','ft.com','bloomberg.com','wsj.com','cnbc.com'];
const sectors=[
 ['chips',/półprzew|semiconductor|micron|nvidia|broadcom|qualcomm|marvell|teradyne|applied materials|lam research|kla|amd|intel|tsmc|sk hynix|asml|formfactor|lattice/i,['eetimes.com','semiengineering.com','eenewseurope.com'],['https://www.eetimes.com/feed/','https://semiengineering.com/feed/']],
 ['security',/cyber|palo alto|security/i,['darkreading.com','securityweek.com','therecord.media']],
 ['data',/centrów danych|arista|vertiv|lumentum|ciena|corning|coherent|amphenol|foton|photon|seagate|western digital|pure storage|everpure|netapp/i,['datacenterdynamics.com','datacenterknowledge.com','lightreading.com','eetimes.com']],
 ['funds',/obligac|etf|overnight|high yield|private equity|akcje |dług |metaverse/i,['etfstream.com','etf.com','etfexpress.com','morningstar.com','investmentweek.co.uk'],['https://www.etf.com/rss.xml']],
 ['health',/farmace|pharma|biotech|biofarm|leki|ochrony zdrowia|opieka medyczna|ochrona zdrowia|veeva|humana|unitedhealth/i,['fiercepharma.com','fiercebiotech.com','biopharmadive.com','healthcaredive.com','statnews.com'],['https://www.biopharmadive.com/feeds/news/']],
 ['finance',/finans|bank|ubezpiecz|płatno|fintech|nu holdings|mastercard|visa|affirm|toast/i,['finextra.com','bankingdive.com','paymentsdive.com','americanbanker.com','insurancejournal.com'],['https://www.bankingdive.com/feeds/news/','https://www.finextra.com/rss/headlines.aspx']],
 ['defence',/obron|defen/i,['defensenews.com','breakingdefense.com','janes.com','aviationweek.com'],['https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml']],
 ['transport',/transport|lotnict|aviation|airlines|schneider|logisty/i,['freightwaves.com','flightglobal.com','aviationweek.com','supplychaindive.com'],['https://www.freightwaves.com/feed']],
 ['chemicals',/chemia|chemic|mosaic|rolnict/i,['icis.com','chemicalweek.com','chemistryworld.com','agriculture.com']],
 ['energy',/energi|ropa|gaz|surow|minerals|solar|utility|chevron|exxon|shell/i,['utilitydive.com','energy-storage.news','pv-magazine.com','rigzone.com','mining.com'],['https://www.utilitydive.com/feeds/news/','https://www.pv-magazine.com/feed/',]],
 ['retail',/handel|retail|towary konsump|napoje|tytoń|home depot|costco|walmart/i,['retaildive.com','grocerydive.com','retailgazette.co.uk']],
 ['games',/gry|games|take.two/i,['gamesindustry.biz','gamedeveloper.com']],
 ['industry',/przemysł|produkcja|budow|elektronika|forgent|vicor/i,['industryweek.com','manufacturingdive.com','constructiondive.com','eetimes.com']],
 ['technology',/technolog|oprogram|sztuczn|analityka|telekom|media społecz/i,['techcrunch.com','theregister.com','cio.com','networkworld.com','lightreading.com']],
];
const aliases={'NVIDIA':['Nvidia'],'Microsoft':['Microsoft'],'Broadcom':['Broadcom'],'Micron Technology':['Micron'],'Advanced Micro Devices':['AMD'],'KLA-Tencor Corporation':['KLA Corporation','KLA'],'Pure Storage':['Everpure','Pure Storage'],'Flextronics International':['Flex Ltd','Flextronics'],'Mosaic Company, The':['Mosaic Company'],'XP':['XP Inc'],'Howard Hughes':['Howard Hughes'],'LPL Financial Holdings Inc':['LPL Financial']};
const official={
 'AKCJA-001':{id:'nvidia-news',url:'https://nvidianews.nvidia.com/releases.xml',home:'https://nvidianews.nvidia.com/',name:'NVIDIA Newsroom'},
 'AKCJA-002':{id:'microsoft-news',url:'https://news.microsoft.com/source/feed/',home:'https://news.microsoft.com/source/',name:'Microsoft Source'},
 'AKCJA-003':{id:'broadcom-ir',url:'https://investors.broadcom.com/rss/news-releases.xml',home:'https://investors.broadcom.com/',name:'Broadcom Investor Relations'},
};
const verifiedEtfs=JSON.parse(readFileSync(new URL('../quote-sources.json',import.meta.url),'utf8')).filter(m=>m.instrumentType==='ETF');
export function publicationProfile(i){
 const name=i.name||i.name_on_screenshot||'',group=i.group_name||i.working_group||'';
 const sector=i.type==='etf'?sectors.find(s=>s[0]==='funds'):sectors.find(s=>s[1].test(name+' '+group));
 const exposure=i.type==='etf'?sectors.find(s=>s[0]!=='funds'&&s[1].test(name+' '+group)):null;
 const full=i.type==='etf'?verifiedEtfs.find(m=>m.instrument_id===i.id)?.verified_name:null;
 const short=name.replace(/[…®]/g,'').replace(/,?\s+(Inc\.?|Corporation|Corp\.?|Holdings|Ltd\.?|Company)(\s.*)?$/i,'').trim();
 const names=[...new Set([...(aliases[name]||[]),full||name.replace(/…/g,''),...(short.length>=5?[short]:[])])].filter(Boolean);
 if(name==='XP')names.splice(0,names.length,'XP Inc');
 return {sector:sector?.[0]||'general',domains:[...new Set([...general,...(sector?.[2]||[]),...(exposure?.[2]||[])])],feeds:[...new Set([...(sector?.[3]||[]),...(exposure?.[3]||[])])],names,name,ticker:i.ticker||i.ticker_on_screenshot||'',type:i.type,review:!sector};
}
export function domainOf(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.hostname.toLowerCase():null;}catch{return null;}}
export function allowedDomain(url,domains){const host=domainOf(url);return !!host&&!host.endsWith('.pl')&&domains.some(d=>host===d||host.endsWith('.'+d));}
function normalize(s){return clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function mentionsInstrument(item,profile){
 const text=' '+normalize(item.title+' '+(item.excerpt||''))+' ';
 if(profile.names.some(name=>text.includes(' '+normalize(name)+' ')))return true;
 if(profile.type==='etf'&&profile.ticker){const issuer=profile.name.match(/^(iShares|Xtrackers|Amundi|Invesco|Vanguard|WisdomTree|UBS|Franklin|JPMorgan|L&G|Ossiam|First Trust|FlexShares)/i)?.[0];return !!issuer&&text.includes(' '+normalize(issuer)+' ')&&text.includes(' '+normalize(profile.ticker.replace(/1$/,''))+' ');}
 return false;
}
export function generatedSources(i){
 if(/do weryfikacji/.test(i.group_name||i.working_group||''))return [];
 const profile=publicationProfile(i),names=profile.names.slice(0,2).map(n=>'"'+n.replace(/["()]/g,'')+'"');
 const q='('+names.join(' OR ')+') ('+profile.domains.map(d=>'site:'+d).join(' OR ')+') when:30d';
 const sources=[{id:'foreign-news-'+i.id.toLowerCase(),instrument_id:i.id,name:'Zagraniczna prasa · '+profile.sector,url:'https://news.google.com/rss/search?'+new URLSearchParams({q,hl:'en-US',gl:'US',ceid:'US:en'}),home:'https://news.google.com/',policy:{...profile,kind:'search'}}];
 for(const [n,url] of profile.feeds.entries())sources.push({id:'industry-'+i.id.toLowerCase()+'-'+n,instrument_id:i.id,name:new URL(url).hostname.replace(/^www\./,''),url,home:new URL(url).origin,policy:{...profile,kind:'industry'}});
 const primary=issuerDomains(i);
 if(primary.length){const query='('+names.join(' OR ')+') ('+primary.map(d=>'site:'+d).join(' OR ')+') ("press release" OR "news release" OR newsroom OR earnings OR "shareholder notice" OR "fund notice") when:30d';sources.push({id:'press-news-'+i.id.toLowerCase(),instrument_id:i.id,name:i.type==='etf'?'Komunikaty emitenta ETF':'Komunikaty spółki',url:'https://news.google.com/rss/search?'+new URLSearchParams({q:query,hl:'en-US',gl:'US',ceid:'US:en'}),home:'https://'+primary[0],policy:{...profile,domains:primary,kind:'press_search'}});}
 if(official[i.id])sources.push({...official[i.id],instrument_id:i.id,policy:{...profile,kind:'official',domains:[domainOf(official[i.id].home)]}});
 return sources;
}
export function syncPublicationSources(db){
 const up=db.prepare(`INSERT INTO sources(id,instrument_id,name,url,home,policy_json,enabled) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,home=excluded.home,policy_json=excluded.policy_json,enabled=1,etag=CASE WHEN sources.url<>excluded.url THEN NULL ELSE sources.etag END,modified=CASE WHEN sources.url<>excluded.url THEN NULL ELSE sources.modified END,last_checked=CASE WHEN sources.url<>excluded.url THEN NULL ELSE sources.last_checked END,url=excluded.url`);
 db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE sources SET enabled=0').run();for(const i of db.prepare('SELECT * FROM instruments').all())for(const s of generatedSources(i))up.run(s.id,s.instrument_id,s.name,s.url,s.home,JSON.stringify(s.policy));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function acceptPublication(source,item){
 if(!source.policy_json)return null;
 const p=JSON.parse(source.policy_json),search=p.kind.endsWith('search');
 const publisherUrl=item.publisher_url||(!search?source.home:null);
 if(!publisherUrl||!allowedDomain(publisherUrl,p.domains)||/[ąćęłńśźż]/i.test(item.title)||/\/(pl-pl|pl)\//i.test(item.url))return null;
 if(!search&&!allowedDomain(item.url,p.domains))return null;
 if(search&&domainOf(item.url)!=='news.google.com'&&!allowedDomain(item.url,p.domains))return null;
 if(p.kind==='press_search'&&!/announc|reports?\b|results?\b|earnings|launch|introduc|agreement|acquir|merger|dividend|buyback|shareholder|fund notice|press release|news release|liquidat|updat|appoint|invest|expand|partnership|collaborat|unveil|declar/i.test(item.title+' '+(item.excerpt||'')))return null;
 if(p.kind!=='official'&&!(p.kind==='press_search'&&p.type==='stock')&&!mentionsInstrument(item,p))return null;
 const publisher=item.publisher_name||new URL(publisherUrl).hostname.replace(/^www\./,'');
 const title=item.title.endsWith(' - '+publisher)?item.title.slice(0,-publisher.length-3):item.title;
 return {...item,title,publisher_name:publisher,publisher_url:publicLink(publisherUrl),eligible:1,publication_kind:['official','press_search'].includes(p.kind)?'press':'article'};
}
