import {installCardDismiss} from './card-dismiss.js?v=1';
import {insightBody,briefBody,eventDateLabel} from './company-insights.js?v=4';
import {portfolioOverview,portfolioPerformance,mergeQuotes,marketLeaders,selectPublications,sortAssets,purchaseImport,samePurchase,mergeInstrumentArticles,summaryNeedsRefresh,summaryVersion,screenshotPrompt} from './portfolio.js?v=original-headlines1';
const $=s=>document.querySelector(s);
const cardDismiss=installCardDismiss($('#detail'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=(v,opts={day:'numeric',month:'short',year:'numeric'})=>v?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',...opts}).format(new Date(v)):'brak daty';
const fullDate=v=>date(v,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
let assetType='stock',assetSearch='',assetSort='name',assetSortDirection='asc';
const openInsights=new Set();
let quoteRefreshing=false;
let data=null,tab='home',filter='wszystkie',query='',toastTimer,activeInstrument=null;
const tabs=[['home','◉','Start'],['assets','▤','Spółki na giełdzie'],['calendar','▦','Kalendarz'],['chat','✦','Codex'],['settings','⚙','Ustawienia']];
async function api(path,body,options={}){
  const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:options.signal});
  const v=await r.json();if(!r.ok){if(r.status===401){$('#shell').hidden=true;$('#login').hidden=false;}throw new Error(v.error||'Nie udało się połączyć');}return v;
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
function empty(symbol,title,description,action=''){return `<div class="empty"><div class="empty-symbol">${symbol}</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`;}
const logo=i=>(['AKCJA-016','AKCJA-017'].includes(i.id)||(i.id.startsWith('AKCJA-')&&Number(i.id.slice(6))>55))?initial(i.name):`<img src="/logos/${esc(i.id)}.png" alt="" width="40" height="40" loading="lazy">`;
const publicationSignal=i=>(i.unread_count||i.insight_unread)?`<span class="publication-signal ${i.insight_unread?'insight-change-signal':''}" role="img" aria-label="${i.insight_unread?'Nowa sytuacja podmiotu':i.unread_count+' nieprzeczytanych publikacji'}"><span class="signal-light" aria-hidden="true"></span><span class="signal-count">${i.insight_unread?'!':i.unread_count}</span></span>`:'';
const initial=name=>esc(name.replace(/^(iShares|Xtrackers|Amundi|Invesco) /,'').slice(0,2).toUpperCase());
function renderNav(){const watched=data.instruments.filter(x=>x.watched).length;$('#nav').innerHTML=tabs.map(([id,icon,label])=>`<button data-tab="${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${id==='watch'?`<span class="nav-count">${watched}</span>`:''}</button>`).join('');}
function render(){
  if(!data)return;
  renderNav();$('#today').textContent=date(data.status.serverTime,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#mode').textContent=data.status.dev?'Podgląd lokalny':'Prywatny przegląd';
  $('#refresh').textContent=data.status.collectionRunning?'Aktualizacja…':data.status.schedulerEnabled?'Automatycznie':'Harmonogram nieaktywny';
  const config={home:['TWOJE INWESTYCJE','Wszystko pod ręką.',''],news:['TWÓJ PRZEGLĄD','Ważne informacje.<br><em>W jednym miejscu.</em>','Publikacje, wyniki i zapowiedzi obserwowanych spółek oraz ETF-ów.'],calendar:['CO PRZED NAMI','Najbliższe wydarzenia.<br><em>Z miejscem na kontekst.</em>','Terminy ze źródeł. Oddzielamy daty potwierdzone od szacowanych.'],watch:['TWOJA LISTA','Obserwuj to,<br><em>co Cię interesuje.</em>','Akcje i ETF-y z Twojej listy. Dodaj wybrane pozycje do obserwowanych.'],settings:['JAK DZIAŁA SYGNAŁ','Źródła i aktualizacje.<br><em>Wszystko pod kontrolą.</em>','Sprawdź dostępność kanałów i status połączenia z Codexem.']}[tab==='assets'?'watch':tab==='chat'?'settings':tab];
  $('#page-title').closest('.page-heading').hidden=tab==='home';
  $('#eyebrow').textContent='';$('#page-title').textContent=({home:'Start',news:'Prasówka',calendar:'Kalendarz',assets:'Spółki na giełdzie',watch:'Obserwowane',settings:'Ustawienia',chat:'Codex'})[tab]||'Lista';$('#page-description').textContent='';
  const missing=data.instruments.filter(x=>x.watched&&!x.source_count).length;
  $('#notice').hidden=!missing;$('#notice').textContent=`${missing} obserwowanych pozycji wymaga jeszcze podłączenia źródeł. Źródła wymagają weryfikacji.`;
  if(tab==='home')renderHome();if(tab==='assets')renderAssets();if(tab==='news')renderNews();if(tab==='watch')renderWatch();if(tab==='calendar')renderCalendar();if(tab==='settings')renderSettings();if(tab==='chat'&&!$('#chat-form'))renderChat();
}
function stats(){const events=data.events.filter(e=>e.review_status==='approved'&&e.event_date>=new Date().toISOString().slice(0,10));return `<div class="stats"><div class="stat"><div><p>Nieprzeczytane publikacje</p><strong>${data.articles.filter(a=>!a.read_at).length}</strong></div><span>↗</span></div><div class="stat"><div><p>Obserwowane pozycje</p><strong>${data.instruments.filter(i=>i.watched).length}<small> / ${data.instruments.length}</small></strong></div><span>◎</span></div><div class="stat"><div><p>Przyszłe wydarzenia</p><strong>${events.length}</strong></div><span>▦</span></div></div>`;}
let newsView='today',newsFrom='',newsTo='',newsScope='mine';
const headline=a=>a.title;
const articleHasText=a=>a.content_status?a.content_status==='available':a.summary_basis==='article';
const articleAccessUnavailable=a=>a.content_status==='unavailable'||(!a.content_status&&['headline','excerpt'].includes(a.summary_basis));
const articleAccessSignal=a=>`<span class="article-access-signal" data-article-access="${esc(a.id)}">${articleHasText(a)?'<span class="article-access-dot" role="img" aria-label="Potwierdzony dostęp do tekstu artykułu do podsumowania" title="Tekst artykułu dostępny do podsumowania"></span>':''}</span>`;
const summaryBasis=a=>a.summary_basis==='article'?'Na podstawie artykułu':a.summary_basis==='headline'?'Dostępny był tylko nagłówek':'Na podstawie fragmentu RSS';
let previousNewsRange=0,previousNewsScope=0;
const expandedNews=new Set(),newsScroll=new Map();
const articleActions=a=>`<div class="article-actions"><button class="secondary" data-article-delete="${esc(a.id)}">Usuń</button></div><div class="article-research-results article-scroll-window" aria-live="polite" role="region" aria-label="Inne doniesienia — przewijana lista" tabindex="0" hidden></div>`;
const screenshotDrafts=new Map();
function screenshotPanel(key,context){
 if(!screenshotDrafts.has(key))screenshotDrafts.set(key,{context,images:[],preparing:false,sending:false,error:'',stage:''});
 const draft=screenshotDrafts.get(key);draft.context=context;
 return `<section class="screenshot-panel" data-screen-panel="${esc(key)}">${screenshotPanelContent(key,draft)}</section>`;
}
function screenshotPanelContent(key,draft){
 const busy=draft.preparing||draft.sending;
 return `<div class="screenshot-panel-tools"><label class="secondary screenshot-picker">Dodaj screeny<input type="file" accept="image/*" multiple data-screen-input="${esc(key)}" ${busy?'disabled':''}></label><small aria-live="polite">${esc(draft.error||draft.stage||'Do 3 screenów · analiza automatyczna w czacie')}</small>${draft.images.length?`<button class="secondary" type="button" data-screen-send="${esc(key)}" ${busy?'disabled':''}>${draft.sending?'Wysyłanie…':draft.preparing?'Przygotowanie…':'Ponów analizę'}</button>`:''}</div>${draft.preparing?'<p class="home-note">Przygotowuję screeny…</p>':''}<div class="screenshot-previews">${draft.images.map((url,index)=>`<div><img src="${esc(url)}" alt="Screen ${index+1}" loading="lazy"><button class="screenshot-remove" type="button" data-screen-remove="${index}" data-screen-key="${esc(key)}" ${busy?'disabled':''} aria-label="Usuń screen ${index+1}">Usuń</button></div>`).join('')}</div>${draft.error?`<p class="error-text" role="alert">${esc(draft.error)}</p>`:''}`;
}
function updateScreenshotPanels(key){
 const draft=screenshotDrafts.get(key);if(!draft)return;
 document.querySelectorAll('[data-screen-panel]').forEach(panel=>{if(panel.dataset.screenPanel===key)panel.innerHTML=screenshotPanelContent(key,draft);});
}
document.addEventListener('change',async event=>{
 const input=event.target;if(!input.matches('[data-screen-input]'))return;
 const key=input.dataset.screenInput,draft=screenshotDrafts.get(key),files=[...input.files];
 if(!draft||draft.preparing||draft.sending||!files.length)return;
 if(files.length+draft.images.length>3){draft.error='Dodaj maksymalnie 3 screeny.';updateScreenshotPanels(key);return;}
 draft.preparing=true;draft.stage='Przygotowuję screeny…';draft.error='';updateScreenshotPanels(key);
 try{const images=await Promise.all(files.map(file=>prepareChatImage(file,{maxEdge:2600,quality:.88})));draft.images.push(...images);}
 catch(error){draft.error=error.message||'Nie można odczytać screena. Wybierz JPG, PNG lub WebP.';draft.stage='';toast(draft.error);}
 finally{draft.preparing=false;updateScreenshotPanels(key);}
 if(!draft.error&&draft.images.length)await sendScreenshotSummary(key);
});
async function sendScreenshotSummary(key){
 const draft=screenshotDrafts.get(key);if(!draft||draft.preparing||draft.sending||!draft.images.length)return;
 draft.sending=true;draft.stage='Sprawdzam połączenie…';draft.error='';updateScreenshotPanels(key);
 try{
  const status=await api('chat/status',undefined,{signal:AbortSignal.timeout(15000)});
  if(!status.connected||!status.authenticated)throw Error('Połącz konto ChatGPT w zakładce Codex.');
  if(status.running||status.publicationBusy)throw Error('Codex jest zajęty. Spróbuj po zakończeniu bieżącej pracy.');
  if(!status.attachments||!status.screenshotCleanup)throw Error('Screeny nie zostały wysłane: most Codexa wymaga aktualizacji obsługi analizy i usuwania zdjęć. Samo wdrożenie backendu w panelu tego nie obejmuje.');
  draft.stage='Wysyłam screeny do analizy…';updateScreenshotPanels(key);
  await api('chat/message',{text:screenshotPrompt(draft.context),images:draft.images,deleteImagesAfterReply:true});
  draft.images=[];activeInstrument=null;if($('#detail').open)cardDismiss.close();tab='chat';render();
  toast('Analiza rozpoczęta. Po odpowiedzi screeny znikną z historii Zorzy.');
 }catch(error){draft.stage='';draft.error=error.name==='TimeoutError'?'Przekroczono czas oczekiwania na połączenie z Codexem. Screeny nie zostały wysłane.':error.message;toast(draft.error);}
 finally{draft.sending=false;updateScreenshotPanels(key);}
}

function addDisclosureControls(root){
 root.querySelectorAll('details').forEach(section=>{
  if([...section.children].some(el=>el.hasAttribute('data-collapse-section')))return;
  const button=document.createElement('button');button.type='button';button.className='disclosure-collapse';button.setAttribute('data-collapse-section','');button.textContent=section.classList.contains('news-expandable')?'⌃ Zwiń artykuł':'⌃ Zwiń';section.append(button);
 });
}
function renderNews(){
 document.querySelectorAll('[data-news-scroll]').forEach(el=>newsScroll.set(el.dataset.newsScroll,el.scrollTop));
 const scoped=data.articles.filter(a=>newsScope==='mine'?a.is_personal:!a.is_personal);
 const articles=selectPublications(scoped,{view:newsView,from:newsFrom,to:newsTo,category:filter,query,now:data.status.serverTime});
 const articleCard=a=>`<details class="news-entry news-expandable" data-news-id="${esc(a.id)}" ${expandedNews.has(a.id)?'open':''}><summary class="news-card"><span class="news-meta"><span class="company-icon">${initial(a.instrument_name)}</span><span class="company-name">${esc(a.instrument_name)}</span>${!a.read_at?'<span class="unread-dot" aria-label="Nieprzeczytane"></span>':''}</span><span class="news-title-row"><strong class="news-title">${esc(headline(a))}</strong><button class="news-title-star ${a.starred?'is-starred':''}" type="button" data-article-star="${esc(a.id)}" aria-pressed="${!!a.starred}" aria-label="${a.starred?'Usuń oznaczenie ważności':'Oznacz jako ważny'}">${a.starred?'★':'☆'}</button></span><span class="news-card-date">${date(a.published_at)}${articleAccessSignal(a)} · ${esc(a.source_name)}${a.publication_kind==='press'?' · Komunikat prasowy':''} <span class="news-expand-hint" aria-hidden="true">⌄</span></span></summary><div class="news-expanded-content"><h3>Podsumowanie</h3><div data-summary-content="${esc(a.id)}" data-summary-compact="true">${summaryContent(a,false)}</div>${a.significance?`<h3>Znaczenie</h3><p>${esc(a.significance)}</p>`:''}<details class="article-excerpt"><summary>Fragment źródła · oryginał</summary><p>${esc(a.title+' · '+(a.excerpt||'Źródło udostępnia wyłącznie nagłówek.'))}</p></details><div class="article-actions news-inline-actions"><button class="secondary" type="button" data-article-delete="${esc(a.id)}">Usuń</button>${summaryButton(a,true,true)}<a class="primary original-link" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Czytaj ↗</a></div><div class="article-research-results article-scroll-window" aria-live="polite" role="region" aria-label="Inne doniesienia" tabindex="0" hidden></div>${screenshotPanel('article:'+a.id,{instrumentName:a.instrument_name,article:{title:a.title,url:a.url,published_at:a.published_at}})}</div></details>`;

 const groups=[['press','Komunikaty prasowe'],['wyniki','Wyniki'],['działania','Działania'],['kontrakty','Kontrakty'],['inne','Inne']].map(([category,label],index)=>{
  const list=articles.filter(a=>(a.publication_kind==='press'?'press':['wyniki','działania','kontrakty'].includes(a.category)?a.category:'inne')===category);
  return list.length?`<section class="dashboard-market news-category-group"><div class="section-label market-banner ${index%2?'market-banner-etf':'market-banner-stock'}"><h2>${label}</h2></div><div class="news-list news-category-window article-scroll-window" data-news-scroll="${category}" role="region" aria-label="Publikacje: ${label}" tabindex="0">${list.map(articleCard).join('')}</div></section>`:'';
 }).join('');
 $('#view').innerHTML=`<div class="news-segmented news-scope-slider scope-${newsScope}" role="group" aria-label="Zakres podmiotów"><span class="news-slider-thumb" aria-hidden="true"></span><button type="button" aria-pressed="${newsScope==='mine'}" data-news-scope="mine">Obserwowane i portfel</button><button type="button" aria-pressed="${newsScope==='other'}" data-news-scope="other">Pozostałe · oryginały</button></div><div class="news-segmented news-day-tabs range-${newsView}" role="group" aria-label="Okres publikacji"><span class="news-slider-thumb" aria-hidden="true"></span>${[['today','Dzisiaj'],['yesterday','Wczoraj'],['before_yesterday','Przedwczoraj'],['archive','Archiwum']].map(([v,label])=>`<button type="button" aria-pressed="${newsView===v}" data-news-view="${v}"><span>${label}</span><small>${selectPublications(scoped,{view:v,now:data.status.serverTime}).length}</small></button>`).join('')}</div><div class="toolbar news-filters">${['week','archive'].includes(newsView)?`<label>Od<input id="news-from" type="date" value="${esc(newsFrom)}"></label><label>Do<input id="news-to" type="date" value="${esc(newsTo)}"></label>`:''}<label>Filtr kategorii<select id="news-category" aria-label="Wybierz kategorię publikacji">${['wszystkie','nieprzeczytane','ważne','komunikaty','wyniki','kontrakty','działania','inne'].map(v=>`<option value="${v}" ${filter===v?'selected':''}>${v==='wszystkie'?'Wszystkie kategorie':v==='komunikaty'?'Komunikaty prasowe':v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label><input class="search" id="search" aria-label="Szukaj publikacji" placeholder="Szukaj spółki lub tematu…" value="${esc(query)}"></div><div class="news-list">${articles.length?groups:empty('▤','Brak publikacji w tym widoku','Sprawdź archiwum, filtry daty i kategorii lub dostępność źródeł.')}</div>`;
 const rangeIndex=['today','yesterday','week','archive'].indexOf(newsView),scopeIndex=newsScope==='mine'?0:1;
 const animateThumb=(selector,from,to)=>{const thumb=$(selector+' .news-slider-thumb');if(thumb&&from!==to&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)thumb.animate?.([{transform:`translateX(${from*100}%)`},{transform:`translateX(${to*100}%)`}],{duration:240,easing:'ease-out'});};
 animateThumb('.news-day-tabs',previousNewsRange,rangeIndex);animateThumb('.news-scope-slider',previousNewsScope,scopeIndex);previousNewsRange=rangeIndex;previousNewsScope=scopeIndex;
 document.querySelectorAll('[data-news-scroll]').forEach(el=>{el.scrollTop=newsScroll.get(el.dataset.newsScroll)||0;});
 document.querySelectorAll('[data-news-id]').forEach(el=>el.addEventListener('toggle',async()=>{
  const id=el.dataset.newsId;if(!el.open){expandedNews.delete(id);return;}expandedNews.add(id);
  const a=data.articles.find(a=>a.id===id);if(a&&!a.read_at){try{await api('read',{id});a.read_at=new Date().toISOString();el.querySelector('.unread-dot')?.remove();const i=data.instruments.find(i=>i.id===a.instrument_id);if(i)i.unread_count=Math.max(0,i.unread_count-1);}catch(err){toast(err.message);}}
 }));
 bindSearch();
 $('#news-from')?.addEventListener('change',e=>{newsFrom=e.target.value;renderNews();});
 $('#news-to')?.addEventListener('change',e=>{newsTo=e.target.value;renderNews();});
 $('#news-category').addEventListener('change',e=>{filter=e.target.value;renderNews();});
}

function bindSearch(){const el=$('#search');if(el)el.addEventListener('input',()=>{const pos=el.selectionStart;query=el.value;if(tab==='watch')renderWatch();else renderNews();$('#search').focus();$('#search').setSelectionRange(pos,pos);});}
function renderWatch(){
 const items=data.instruments.filter(i=>i.watched&&`${i.name} ${i.ticker||''} ${i.group_name||''}`.toLowerCase().includes(query.toLowerCase()));
 const percent=v=>new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(Math.abs(v));
 $('#view').innerHTML=`<input id="search" class="search asset-search" placeholder="Szukaj w obserwowanych…" aria-label="Szukaj w obserwowanych" value="${esc(query)}">`+['stock','etf'].map(type=>{
  const list=items.filter(i=>i.type===type);
  return `<section class="dashboard-market"><div class="section-label market-banner market-banner-${type}"><h2>${type==='stock'?'Akcje':'ETF-y'} <small>${list.length}</small></h2><button class="text-button" data-asset="${type}">Cała lista · dodaj →</button></div><div class="dashboard-rankings watch-rankings"><div class="movers">${list.length?list.map(i=>{const q=data.quotes.find(q=>q.instrument_id===i.id);return `<button class="mover-card" data-instrument="${esc(i.id)}"><span class="logo-wrap" data-signal-owner="${esc(i.id)}"><span class="company-icon">${logo(i)}</span>${publicationSignal(i)}</span><span class="mover-identity"><strong>${esc(i.name)}</strong><small>${q?money(q.price,q.currency):'Brak notowania'}</small></span><span class="mover-change">${q&&Number.isFinite(q.change_percent)?`<span class="${q.change_percent>=0?'gain':'loss'}">${q.change_percent>=0?'↑ +':'↓ −'}${percent(q.change_percent)}%</span><small>${date(q.as_of)}</small>`:'<small>—</small>'}</span></button>`;}).join(''):query?'<p class="home-empty">Brak pasujących obserwowanych pozycji.</p>':'<p class="home-empty">Jeszcze nic nie obserwujesz w tej grupie. Wybierz pozycje z całej listy.</p>'}</div></div></section>`;
 }).join('');
 bindSearch();
}

function renderCalendar(){
  const pending=data.events.filter(e=>e.review_status==='pending');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const all=data.events.filter(e=>e.review_status==='approved'&&(e.event_end_date||e.event_date)>=today);
  const now=Date.now();const horizons=[['Najbliższe 30 dni',0,30],['Od 31 dni do 6 miesięcy',30,183],['Od 6 do 12 miesięcy',183,366],['Późniejsze terminy',366,Infinity]];
  const eventCard=e=>`<article class="event-card"><div class="event-date"><strong>${e.date_precision&&e.date_precision!=='day'?e.event_date.slice(0,4):date(e.event_date+'T12:00:00Z',{day:'numeric'})}</strong><span>${e.date_precision&&e.date_precision!=='day'?esc(eventDateLabel(e).replace(e.event_date.slice(0,4),'').trim()||'rok'):date(e.event_date+'T12:00:00Z',{month:'short',year:'numeric'})}</span></div><div class="event-copy"><span class="eyebrow">${esc(e.instrument_name)}</span><h3>${esc(e.title)}</h3><span class="tag">${e.certainty==='confirmed'?'Termin wskazany w źródle':'Termin szacowany'}</span><p>${'Zapisano automatycznie · '+(e.certainty==='estimated'?'szacowany termin':'termin ze źródła')}</p><details class="calendar-evidence"><summary>Fragment źródła</summary><blockquote class="event-evidence">${esc(e.evidence)}</blockquote></details><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Otwórz źródło ↗</a><div class="row-actions">${e.review_status==='pending'?`<button class="primary small" data-review="${e.id}" data-status="approved">Zatwierdź datę</button><button class="secondary" data-review="${e.id}" data-status="rejected">Odrzuć</button>`:`<button class="secondary" data-ics="${e.id}">Dodaj do kalendarza telefonu ↓</button>`}</div></div></article>`;
  const section=(label,content,index=0)=>`<section class="dashboard-market calendar-section"><div class="section-label market-banner ${index%2?'market-banner-etf':'market-banner-stock'}"><h2>${label}</h2></div><div class="calendar-events">${content}</div></section>`;
  $('#view').innerHTML='<div class="calendar-page">'+(pending.length?section('Do sprawdzenia',pending.map(eventCard).join(''),1):'')+horizons.map(([label,lo,hi],index)=>{const list=all.filter(e=>{const days=Math.max(0,(Date.parse(e.event_date+'T23:59:59Z')-now)/864e5);return days>=lo&&days<hi;});if(index===3&&!list.length)return '';return section(label,list.length?list.map(eventCard).join(''):'<p class="home-empty">Brak zapisanych terminów w tym okresie. Pojawią się po odczytaniu dat ze źródeł.</p>',index);}).join('')+'</div>';
}

let settingsSourcesOpen=false;
function renderSettings(){
 const s=data.status,p=data.settings;
 const frequency=(name,label)=>`<label>${label}<select name="${name}">${[['daily','Raz dziennie'],['twice_daily','Dwa razy dziennie'],['twice_weekly','Dwa razy w tygodniu']].map(([v,t])=>`<option value="${v}" ${p[name]===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
 $('#view').innerHTML=`<div class="settings-grid"><section class="settings-card"><form id="preferences" class="purchase-form"><h2>Aktualizacje</h2>${frequency('pricesFrequency','Ceny')}${frequency('publicationsFrequency','Publikacje')}<label>Opisy i briefy AI<select name="insightsScope">${[['disabled','Wyłączone'],['personal','Obserwowane i portfel']].map(([v,t])=>`<option value="${v}" ${p.insightsScope===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="home-note">Opisy i briefy: poniedziałek i czwartek 14:30. Pierwszy opis po dodaniu podmiotu.</p><p class="home-note">Nagłówki w języku oryginału. Podsumowania po polsku na żądanie.</p><h2>Przypomnienia</h2><label>Wyprzedzenie<select name="reminderDays">${[[0,'W dniu wydarzenia'],[1,'Dzień wcześniej'],[3,'3 dni wcześniej'],[7,'Tydzień wcześniej']].map(([v,t])=>`<option value="${v}" ${p.reminderDays===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Godzina (Polska)<select name="reminderHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${p.reminderHour===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}</select></label><button class="primary" type="submit">Zapisz</button><p id="preferences-error" role="alert"></p></form></section><section class="settings-card"><h2>Status</h2><div class="setting-row"><span>Nagłówki</span><strong>Oryginalne · bez tłumaczenia</strong></div><div class="setting-row"><span>Podsumowania AI</span><strong>${s.summaryWorkerConfigured?'Na żądanie · serwer':'Do włączenia na serwerze'}</strong></div><div class="setting-row"><span>Publikacje</span><strong>${s.schedulerEnabled?'Harmonogram aktywny':'Wymaga uruchomienia na serwerze'}</strong></div><div class="setting-row"><span>Ceny</span><strong>${s.pricesRunning?'Pobieranie…':s.pricesConnected?`Yahoo Finance · ${s.quotesReport?.downloaded||0}/${data.instruments.length}`:'Brak pobranych notowań'}</strong></div><p class="home-note">${s.quotesReport?.unmapped?.length?`Źródło do weryfikacji: ${s.quotesReport.unmapped.length} pozycji` : ''}${s.quotesReport?.stopped?' · Pobieranie przerwane przez źródło':''}</p><div class="setting-row"><span>Kalendarz aplikacji</span><strong>Automatyczny zapis dat</strong></div><div class="setting-row"><span>Push na telefon</span><strong>Do uruchomienia po wdrożeniu</strong></div><p>Ustawienia przypomnień zapisane. Wysyłka na telefon jeszcze nie działa.</p><p>Ceny: ${p.pricesFrequency==='twice_daily'?'15:40 i 21:45':'15:40'}${p.pricesFrequency==='twice_weekly'?' · wtorek i piątek':''}. Czas polski.</p><p>Obserwowane i portfel: dodatkowo codziennie 18:30.</p><p>Publikacje: ${p.publicationsFrequency==='twice_daily'?'15:40 i 21:45':'15:40'}${p.publicationsFrequency==='twice_weekly'?' · wtorek i piątek':''}. Kalendarz: codziennie 15:40. Czas polski.</p><button class="secondary" id="install-settings">Dodaj na telefon</button></section><details class="settings-card settings-sources" ${settingsSourcesOpen?'open':''}><summary>Źródła</summary><p>Zagraniczne portale branżowe i komunikaty podmiotów. Źródła dobierane automatycznie do branży; wydawca sprawdzany przed publikacją.</p>${data.sources.map(x=>`<div class="source-row"><a href="${esc(x.home)}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a><p>${x.error?esc(x.error):x.last_checked?'Sprawdzono '+fullDate(x.last_checked):'Jeszcze nie sprawdzano'}</p>${x.newest_publication&&Date.now()-Date.parse(x.newest_publication)>30*864e5?'<p class="error-text">Starsze materiały · '+date(x.newest_publication)+'</p>':''}</div>`).join('')}</details></div>`;
 addDisclosureControls($('#view'));
 $('.settings-sources').addEventListener('toggle',e=>{settingsSourcesOpen=e.currentTarget.open;});
 $('#preferences').addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.reminderDays=Number(b.reminderDays);b.reminderHour=Number(b.reminderHour);try{await api('settings',b);await load();toast('Ustawienia zapisane');}catch(err){$('#preferences-error').textContent=err.message;}});
 $('#install-settings').addEventListener('click',installHelp);
}
function installHelp(){showDialog('<span class="eyebrow">ZORZA NA TELEFONIE</span><h2>Twoja aplikacja,<br>jedno dotknięcie dalej.</h2><p>1. Otwórz wdrożony adres HTTPS w Safari na iPhonie.</p><p>2. Dotknij przycisku <strong>Udostępnij</strong>.</p><p>3. Wybierz <strong>Dodaj do ekranu początkowego</strong> i potwierdź nazwę „Zorza”.</p><p>Podgląd pod adresem 127.0.0.1 działa tylko na tym komputerze. Po wdrożeniu otrzymasz adres dostępny z telefonu.</p>');}
let dialogPageScroll=null;
function lockDialogBackground(){if(dialogPageScroll!==null)return;dialogPageScroll=window.scrollY;document.body.style.top=`-${dialogPageScroll}px`;document.body.classList.add('dialog-page-locked');document.documentElement.classList.add('dialog-page-locked');}
function unlockDialogBackground(){if(dialogPageScroll===null)return;const y=dialogPageScroll;dialogPageScroll=null;document.body.classList.remove('dialog-page-locked');document.documentElement.classList.remove('dialog-page-locked');document.body.style.top='';window.scrollTo({top:y,left:0,behavior:'instant'});}
function showDialog(html){if(!html.includes('class="modal-close-row"'))html='<div class="modal-close-row"><button class="modal-close" type="button" data-close-dialog aria-label="Zamknij">×</button></div>'+html;$('#detail-body').innerHTML=html;addDisclosureControls($('#detail-body'));cardDismiss.reset();$('#detail').scrollTop=0;if(!$('#detail').open){lockDialogBackground();$('#detail').showModal();}}
$('#detail').addEventListener('close',()=>{activeInstrument=null;unlockDialogBackground();refreshQuotes().catch(()=>{});});
const profileArticles=new Map();
function applyInstrumentArticles(instrumentId,articles){profileArticles.set(instrumentId,articles);data.articles=mergeInstrumentArticles(data.articles,instrumentId,articles);}
function summaryContent(a,withActions=true){
 if(articleAccessUnavailable(a))return '<p class="muted">Nie mam dostępu do treści artykułu. Dostępny jest tylko nagłówek lub fragment — podsumowanie nie zostało wygenerowane.</p>';
 if(a.summary)return `<p>${esc(a.summary)}</p><small>${summaryBasis(a)}</small>`;
 const status=({queued:'Podsumowanie w kolejce…',running:'Powstaje podsumowanie…',failed:'Nie udało się przygotować podsumowania.'})[a.job_status]||'Podsumowanie nie jest jeszcze gotowe.';
 if(!withActions)return a.job_status?`<p class="muted">${status}</p>`:'';
 const action=a.job_status==='failed'?`<button class="secondary" data-summary-retry="${esc(a.id)}">Ponów podsumowanie</button>`:summaryNeedsRefresh(a)?'':`<button class="secondary" data-summarize="${esc(a.id)}">Przygotuj podsumowanie</button>`;
 return `<p class="muted">${status}</p>${action}${summaryNeedsRefresh(a)?'<small>Wynik pojawi się tutaj automatycznie.</small>':''}`;
}
let summaryRefreshBusy=false,summaryRefreshCursor=0;
async function refreshVisibleSummaries(){
 if(summaryRefreshBusy||document.hidden||!data||$('#shell').hidden)return;
 const root=$('#detail').open?$('#detail-body'):$('#view');
 const visible=[...root.querySelectorAll('[data-summary-content],[data-summary-slot]')].filter(node=>!node.closest('details:not([open])'));
 const pending=visible.map(node=>findArticle(node.dataset.summaryContent||node.dataset.summarySlot)).filter(summaryNeedsRefresh);
 const instruments=[...new Set(pending.map(a=>a.instrument_id))];if(!instruments.length)return;
 const id=instruments[summaryRefreshCursor++%instruments.length];
 const previous=new Map(visible.map(node=>{const id=node.dataset.summaryContent||node.dataset.summarySlot;return [id,summaryVersion(findArticle(id))];}));
 summaryRefreshBusy=true;
 try{
  const result=await api('instrument-articles?id='+encodeURIComponent(id));applyInstrumentArticles(id,result.articles);
  // Resolve current DOM nodes after the request; the reader may have navigated.
  const currentRoot=$('#detail').open?$('#detail-body'):$('#view');
  for(const signal of currentRoot.querySelectorAll('[data-article-access]')){const a=findArticle(signal.dataset.articleAccess);if(a)signal.innerHTML=articleHasText(a)?'<span class="article-access-dot" role="img" aria-label="Potwierdzony dostęp do tekstu artykułu do podsumowania" title="Tekst artykułu dostępny do podsumowania"></span>':'';}
  for(const node of currentRoot.querySelectorAll('[data-summary-content],[data-summary-slot]')){
   const articleId=node.dataset.summaryContent||node.dataset.summarySlot,a=findArticle(articleId);
   if(a&&previous.has(articleId)&&previous.get(articleId)!==summaryVersion(a))node.innerHTML=node.dataset.summaryContent?summaryContent(a,!node.hasAttribute('data-summary-compact')):summaryButton(a,false,node.hasAttribute('data-summary-compact'));
  }
 }catch{}finally{summaryRefreshBusy=false;}
}
setInterval(refreshVisibleSummaries,5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVisibleSummaries();});

const findArticle=id=>data.articles.find(a=>a.id===id)||[...profileArticles.values()].flat().find(a=>a.id===id);
async function detail(id){const known=findArticle(id);if(known){try{const r=await api('instrument-articles?id='+encodeURIComponent(known.instrument_id));applyInstrumentArticles(known.instrument_id,r.articles);}catch{}}const a=findArticle(id);if(!a)return;
 const i=data.instruments.find(i=>i.id===a.instrument_id);
 const status=({queued:'Podsumowanie w kolejce',running:'Powstaje podsumowanie',failed:'Nie udało się przygotować podsumowania'})[a.job_status]||'Podsumowanie nie jest jeszcze gotowe';
 showDialog(`<div class="modal-close-row"><button class="modal-close" type="button" ${activeInstrument?`data-back-profile="${esc(activeInstrument)}"`:'data-close-dialog'} aria-label="Zamknij artykuł">×</button></div><div class="article-issuer">${i?`<span class="company-icon">${logo(i)}</span>`:''}<span>${esc(a.instrument_name)}</span></div><div class="article-title-row"><h2 class="article-title">${esc(headline(a))}</h2></div><div class="article-return-row"><button class="article-title-star ${a.starred?'is-starred':''}" type="button" data-article-star="${esc(a.id)}" aria-pressed="${!!a.starred}" aria-label="${a.starred?'Usuń oznaczenie ważności':'Oznacz jako ważny'}">${a.starred?'★':'☆'}</button></div><p class="article-meta">${esc(a.source_name)} · ${date(a.published_at)}${articleAccessSignal(a)}</p><section class="article-merit"><h3>Podsumowanie</h3><div data-summary-content="${esc(a.id)}" data-summary-compact="true">${summaryContent(a,false)}</div></section><div class="article-actions article-bottom-actions article-modal-actions"><button class="secondary" type="button" data-article-delete="${esc(a.id)}">Usuń</button>${summaryButton(a,true,true)}<a class="primary original-link" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Czytaj ↗</a></div><div class="article-research-results" aria-live="polite" hidden></div><details class="article-excerpt"><summary>Fragment źródła · oryginał</summary><p>${esc(a.title+' · '+(a.excerpt||'Źródło udostępnia wyłącznie nagłówek.'))}</p></details>${screenshotPanel('article:'+a.id,{instrumentName:a.instrument_name,article:{title:a.title,url:a.url,published_at:a.published_at}})}`);
 if(!a.read_at){await api('read',{id});a.read_at=new Date().toISOString();if(i)i.unread_count=Math.max(0,i.unread_count-1);render();}
}
function exportIcs(id){const e=data.events.find(x=>x.id===id);if(!e)return;const escapeIcs=s=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\r/g,'');const start=e.event_date.replaceAll('-','');const end=new Date(Date.parse((e.event_end_date||e.event_date)+'T00:00:00Z')+864e5).toISOString().slice(0,10).replaceAll('-','');const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zorza//PL','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${e.id}@sygnal`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'')}`,`DTSTART;VALUE=DATE:${start}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${escapeIcs(e.instrument_name+': '+e.title)}`,`DESCRIPTION:${escapeIcs((e.certainty==='estimated'?'TERMIN SZACOWANY: '+eventDateLabel(e)+'. ':'')+'Źródło: '+e.url+'\n'+e.evidence)}`,'END:VEVENT','END:VCALENDAR'];const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='sygnal-wydarzenie.ics';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function load(){const next=await api('dashboard');next.quotes=mergeQuotes(data?.quotes,next.quotes);data=next;render();}
document.addEventListener('click',async event=>{const el=event.target.closest('button,[data-instrument],[data-profile-row]');if(!el)return;try{
  if(el.hasAttribute('data-collapse-section')){const section=el.closest('details');if(section){section.open=false;const summary=section.querySelector('summary'),region=section.closest('.article-scroll-window');if(section.dataset.newsId)expandedNews.delete(section.dataset.newsId);if(region&&summary)region.scrollTop+=summary.getBoundingClientRect().top-region.getBoundingClientRect().top-8;summary?.focus({preventScroll:true});}}
  else if(el.dataset.screenSend){await sendScreenshotSummary(el.dataset.screenSend);}
  else if(el.hasAttribute('data-screen-remove')){const draft=screenshotDrafts.get(el.dataset.screenKey);if(draft&&!draft.preparing&&!draft.sending){draft.images.splice(Number(el.dataset.screenRemove),1);updateScreenshotPanels(el.dataset.screenKey);}}
  else if(el.hasAttribute('data-close-dialog')){activeInstrument=null;cardDismiss.close();}
  else if(el.dataset.toggleInsight){const id=el.dataset.toggleInsight,region=document.getElementById('profile-situation-'+id);const open=region.hidden;region.hidden=!open;el.setAttribute('aria-expanded',String(open));el.querySelector('[aria-hidden]')?.replaceChildren(document.createTextNode(open?'⌃':'⌄'));if(open){openInsights.add(id);await acknowledgeInsight(id);}else openInsights.delete(id);}
  else if(el.dataset.companyPublications){await companyPublications(el.dataset.companyPublications);}
  else if(el.dataset.companyComment){commentForm(el.dataset.companyComment);}
  else if(el.dataset.insightRetry){el.disabled=true;await api('insight-retry',{id:el.dataset.insightRetry});await load();if(activeInstrument)await instrumentDetail(activeInstrument);}
  else if(el.dataset.newsScope){newsScope=el.dataset.newsScope;query='';renderNews();}
  else if(el.dataset.newsView){newsView=el.dataset.newsView;newsFrom='';newsTo='';renderNews();}
  else if(el.dataset.articleResearch){
   const box=el.closest('.article-actions').nextElementSibling;box.hidden=false;box.textContent='Szukam innych doniesień…';el.disabled=true;
   try{const result=await api('article-research',{id:el.dataset.articleResearch});box.innerHTML=`<h3>Inne doniesienia</h3><p class="home-note">${esc(result.scope)}. Daty poniżej dotyczą publikacji, nie wydarzenia. Datę wydarzenia lub dokument trzeba potwierdzić w źródle.</p>${result.results.length?result.results.map(item=>`<article><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a><small>${esc(item.publisher_name||'Źródło RSS')} · ${date(item.published_at)}</small>${item.excerpt?`<p>${esc(item.excerpt)}</p>`:''}</article>`).join(''):'<p>Nie znaleziono innych doniesień w tym wyszukiwaniu. Sprawdź również oryginalną publikację.</p>'}`;}catch(error){box.textContent='Nie udało się wyszukać doniesień. '+error.message;}finally{el.disabled=false;}
  }
  else if(el.dataset.articleStar){event.preventDefault();const a=findArticle(el.dataset.articleStar);if(a){await api('article-star',{id:a.id,starred:!a.starred});a.starred=a.starred?0:1;render();if($('#detail').open)await detail(a.id);}}
  else if(el.dataset.articleDelete){if(confirm('Usunąć tę publikację?')){await api('article-delete',{id:el.dataset.articleDelete});data.articles=data.articles.filter(a=>a.id!==el.dataset.articleDelete);if($('#detail').open)cardDismiss.close();await load();}}
  else if(el.dataset.backProfile){instrumentDetail(el.dataset.backProfile);}
  else if(el.dataset.asset){assetType=el.dataset.asset;tab='assets';assetSearch='';render();}
  else if(el.dataset.instrument){instrumentDetail(el.dataset.instrument);}
  else if(el.dataset.profileRow){instrumentDetail(el.dataset.profileRow);}
  else if(el.dataset.comment){await commentForm(el.dataset.comment);}
  else if(el.dataset.buy){purchaseForm(el.dataset.buy);}
  else if(el.dataset.deletePurchase){if(confirm('Usunąć ten zapis zakupu?')){await api('purchase-delete',{id:el.dataset.deletePurchase});await load();instrumentDetail(el.dataset.owner);}}
  else if(el.dataset.tab){activeInstrument=null;tab=el.dataset.tab;filter='wszystkie';query='';render();window.scrollTo({top:0});}
  else if(el.dataset.filter){filter=el.dataset.filter;render();}
  else if(el.dataset.watch){const i=data.instruments.find(i=>i.id===el.dataset.watch);await api('watch',{id:i.id,watched:!i.watched});await load();if(el.classList.contains('profile-watch-star'))await instrumentDetail(i.id);}
  else if(el.dataset.article)await detail(el.dataset.article);
  else if(el.hasAttribute('data-prices')){el.disabled=true;const result=await api('prices',{});toast(result.recent?'Ceny sprawdzano w ostatnich 15 minutach':'Rozpoczęto pobieranie cen');await load();}
  else if(el.dataset.summaryRetry){el.disabled=true;const a=findArticle(el.dataset.summaryRetry);const job=a.job_id?{id:a.job_id}:data.jobs.find(j=>j.article_id===a.id&&j.status==='failed');if(!job)throw Error('Odśwież dane zadania i spróbuj ponownie');await api('retry',{id:job.id});await load();await detail(a.id);}
  else if(el.dataset.summarize){el.disabled=true;await api('summarize',{id:el.dataset.summarize});await load();if(tab!=='news'||!expandedNews.has(el.dataset.summarize))await detail(el.dataset.summarize);toast('Zlecenie zapisane w kolejce Codexa.');}
  else if(el.dataset.review){await api('event-review',{id:el.dataset.review,status:el.dataset.status});await load();}
  else if(el.dataset.retry){await api('retry',{id:el.dataset.retry});await load();toast('Zlecono ponowienie.');}
  else if(el.dataset.ics)exportIcs(el.dataset.ics);
  else if(el.id==='refresh'||el.hasAttribute('data-collect')){await api('collect',{});toast('Rozpoczęto sprawdzanie obserwowanych źródeł.');await load();}
}catch(e){toast(e.message);el.disabled=false;}});
$('#install').addEventListener('click',installHelp);
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('login',{password:$('#password').value});$('#password').value='';$('#login').hidden=true;$('#shell').hidden=false;await load();}catch(err){$('#login-error').textContent=err.message;}});
try{const session=await api('session');$('#login').hidden=session.authenticated;$('#shell').hidden=!session.authenticated;if(session.authenticated)await load();}catch(e){$('#login').hidden=false;$('#login-error').textContent='Nie można połączyć się z serwerem. Sprawdź dostęp do internetu.';}
setInterval(()=>refreshQuotes().catch(()=>{}),30000);
setInterval(async()=>{if(!document.hidden&&!$('#shell').hidden&&!document.activeElement?.matches('input,select,textarea')&&!$('#detail').open){try{await load();}catch{toast('Połączenie przerwane. Widoczne dane mogą być nieaktualne.');}}},120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshQuotes().catch(()=>{});});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});


function number(v){return new Intl.NumberFormat('pl-PL',{maximumFractionDigits:6}).format(v);}
function money(v,c){return new Intl.NumberFormat('pl-PL',{style:'currency',currency:c}).format(v);}
function holdings(id){return data.purchases.filter(p=>p.instrument_id===id);}
function quote(i,compact=false){const q=data.quotes.find(q=>q.instrument_id===i.id);const missing=data.status.quotesReport?.unmapped?.includes(i.id)?'Źródło do potwierdzenia':data.status.quotesReport?.errors?.some(e=>e.instrument_id===i.id)?'Źródło nieaktualne lub niedostępne':'Brak notowania';return q?`<strong>${money(q.price,q.currency)}</strong><span class="${q.change_percent>=0?'gain':'loss'}">${q.change_percent>=0?'↑ +':'↓ −'}${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(Math.abs(q.change_percent))}%${compact?'':' · względem poprzedniego zamknięcia'}</span><small class="quote-time">${compact?date(q.as_of,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):esc(q.source)+' · Notowanie z '+fullDate(q.as_of)}</small>`:'<strong>—</strong><small>'+missing+'</small>';}
function dailyQuoteChange(q){return `<span class="${q.change_percent>=0?'gain':'loss'}">${q.change_percent>=0?'↑ +':'↓ −'}${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(Math.abs(q.change_percent))}%</span><small class="${q.change_amount>=0?'gain':'loss'}">${q.change_amount>=0?'+':'−'}${money(Math.abs(q.change_amount),q.currency)}</small>`;}
function ownedQuote(i){return i?.quote?`<strong>${money(i.quote.price,i.quote.currency)}</strong>${dailyQuoteChange(i.quote)}<small class="quote-time">${date(i.quote.as_of,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</small>`:'<strong>—</strong><small>Brak notowania</small>';}
function paintCurrentQuotes(){
 const owned=new Map(portfolioOverview(data.instruments,data.purchases,data.quotes).owned.map(i=>[i.id,i]));
 document.querySelectorAll('#view .quote[data-instrument]').forEach(el=>{const i=data.instruments.find(i=>i.id===el.dataset.instrument);if(i)el.innerHTML=el.closest('.home-holding')?ownedQuote(owned.get(i.id)):quote(i,true);});
 const target=$('#detail .profile-quote-with-star'),i=data.instruments.find(i=>i.id===activeInstrument);
 if(target&&i){const star=target.querySelector('.profile-watch-star'),focused=document.activeElement===star;target.innerHTML=quote(i).replace('</strong>','</strong>'+(star?.outerHTML||''));if(focused)target.querySelector('.profile-watch-star')?.focus({preventScroll:true});}
}
async function refreshQuotes(){
 if(quoteRefreshing||document.hidden||!data||$('#shell').hidden)return;
 quoteRefreshing=true;
 try{const result=await api('quotes',undefined,{signal:AbortSignal.timeout(10000)});data.quotes=mergeQuotes(data.quotes,result.quotes);Object.assign(data.status,result.status,{serverTime:result.serverTime});
  if(!$('#detail').open&&tab==='home'&&!purchaseImportRunning&&!document.activeElement?.matches('input,select,textarea'))renderHome();else paintCurrentQuotes();
 }finally{quoteRefreshing=false;}
}


let purchaseImportRunning=false;
function renderHome(){
 const {owned}=portfolioOverview(data.instruments,data.purchases,data.quotes);
 const performance=portfolioPerformance(data.instruments,data.purchases,data.quotes);
 const signed=(value,currency)=>`${value>=0?'+':'−'}${money(Math.abs(value),currency)}`;
 const portfolioStatus=performance.map(g=>`<div class="portfolio-performance"><div class="portfolio-performance-main"><span>${g.complete?'Wartość portfela':'Wartość wycenionej części'} · ${esc(g.currency)}</span><strong>${g.value===null?'—':money(g.value,g.currency)}</strong></div><div class="portfolio-performance-result"><span>${g.complete?'Wynik od zakupu':'Wynik wycenionej części'}</span>${g.profit===null?'<strong>Brak wyceny</strong>':`<strong class="${g.profit>=0?'gain':'loss'}">${signed(g.profit,g.currency)}${g.percent===null?'':` · ${g.percent>=0?'+':'−'}${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(Math.abs(g.percent))}%`}</strong>`}</div><small>Koszt zakupu: ${money(g.cost,g.currency)}${g.oldest?` · Notowania: ${fullDate(g.oldest)}${g.oldest===g.newest?'':` — ${fullDate(g.newest)}`}`:''}</small>${g.missing.length?`<p class="home-note">Brak zgodnej wyceny ${g.missing.length} pozycji. Wynik całego portfela w tej walucie jest niedostępny.</p>`:''}</div>`).join('');
 const change=dailyQuoteChange;
 const row=i=>`<div class="company-card"><article class="asset-row home-holding"><button class="asset-name" data-instrument="${i.id}"><span class="logo-wrap" data-signal-owner="${esc(i.id)}"><span class="company-icon">${logo(i)}</span>${publicationSignal(i)}</span><span><strong>${esc(i.name)}</strong><small>${number(i.quantity)} szt.</small></span></button><div class="quote" data-instrument="${i.id}" role="button" tabindex="0" aria-label="Notowanie ${esc(i.name)}">${ownedQuote(i)}</div></article></div>`;
 const leaderCard=i=>`<button class="mover-card" data-instrument="${esc(i.id)}"><span class="company-icon">${logo(i)}</span><span class="mover-identity"><strong>${esc(i.name)}</strong><small>${money(i.quote.price,i.quote.currency)}</small></span><span class="mover-change">${change(i.quote)}</span></button>`;
 const watched=data.instruments.filter(i=>i.watched);
 const watchedSection=`<section class="dashboard-market dashboard-watched"><div class="section-label market-banner market-banner-etf"><h2>Obserwowane <small>${watched.length}</small></h2><button class="text-button" data-tab="assets">Dodaj →</button></div><div class="asset-list">${watched.length?watched.map(i=>companyCard(i,{showTools:false})).join(''):'<p class="home-empty">Dodaj podmioty z zakładki „Spółki na giełdzie”.</p>'}</div></section>`;
 const rankings=marketLeaders(data.instruments,data.quotes).map(g=>`<section class="dashboard-market"><div class="section-label market-banner market-banner-${g.type}"><h2>${g.type==='stock'?'Akcje':'ETF-y'}</h2><button class="text-button" data-asset="${g.type}">Cała lista →</button></div><p class="home-note">${g.asOf?date(g.asOf+'T12:00:00Z'):'Brak notowań — ranking jeszcze niedostępny.'}</p><div class="dashboard-rankings">${[['gains','Najwyższe wzrosty'],['losses','Największe spadki']].map(([key,label])=>`<section><h3>${label} · TOP 3</h3><div class="movers">${g[key].length?g[key].map(leaderCard).join(''):'<p class="home-empty">Brak takich zmian w dostępnych notowaniach.</p>'}</div></section>`).join('')}</div></section>`).join('');
 $('#view').innerHTML=`<section class="dashboard-market dashboard-portfolio"><div class="section-label market-banner market-banner-portfolio"><h2>Portfel <small>${owned.length}</small></h2><label class="portfolio-import">Wczytaj zakupy<input type="file" id="purchase-import" accept=".json,application/json"></label></div>${portfolioStatus}<div class="asset-list">${owned.length?owned.map(row).join(''):'<div class="home-empty">Brak zakupów. Dodaj je w profilu akcji lub ETF-u.</div>'}</div></section>`+watchedSection+`<p class="home-note">Ceny sesji regularnej · możliwe opóźnienie.</p>`+rankings;

 $('#purchase-import').addEventListener('change',async e=>{
  const input=e.currentTarget,file=input.files[0];if(!file||purchaseImportRunning)return;purchaseImportRunning=true;let saved=0,skipped=0;input.disabled=true;
  try{if(file.size>100000)throw Error('Plik zakupów jest za duży');const records=purchaseImport(JSON.parse(await file.text()),data.instruments);await load();
   for(const record of records){if(data.purchases.some(existing=>samePurchase(existing,record))){skipped++;continue;}await api('purchase',record);data.purchases.push(record);saved++;}
   await load();toast(`Zapisano ${saved} zakupów${skipped?`; pominięto ${skipped} już zapisanych`:''}.`);
  }catch(err){toast(`Zapisano ${saved}. ${err.message}`);}finally{purchaseImportRunning=false;input.disabled=false;input.value='';}
 });

}
function renderAssets(){
 $('#page-title').textContent='Spółki na giełdzie';$('#page-description').textContent='';
 const items=data.instruments.filter(i=>i.type===assetType&&!i.watched&&!holdings(i.id).length&&`${i.name} ${i.ticker||''}`.toLowerCase().includes(assetSearch.toLowerCase()));
 const list=sortAssets(items,data.quotes,assetSort,assetSortDirection);
 $('#view').innerHTML=`<div class="chips"><button class="chip ${assetType==='stock'?'active':''}" data-asset="stock">Akcje</button><button class="chip ${assetType==='etf'?'active':''}" data-asset="etf">ETF-y</button></div><input class="search asset-search" id="asset-search" aria-label="Szukaj na liście" placeholder="Szukaj na liście…" value="${esc(assetSearch)}"><div class="asset-sort-controls"><label for="asset-sort">Sortuj według</label><select id="asset-sort">${[['name','Nazwa'],['price','Cena'],['change','Zmiana (%)']].map(([value,label])=>`<option value="${value}" ${assetSort===value?'selected':''}>${label}</option>`).join('')}</select><button class="secondary" id="asset-sort-direction" type="button" aria-label="Zmień kolejność sortowania">${assetSortDirection==='asc'?'↑':'↓'}</button></div>${assetSort==='price'?'<p class="home-note">Ceny w walutach notowań.</p>':''}<div class="asset-list">${list.length?list.map(i=>companyCard(i)).join(''):'<p class="home-empty">Brak pozostałych pozycji w tej grupie.</p>'}</div>`;
 $('#asset-sort').addEventListener('change',e=>{assetSort=e.target.value;assetSortDirection=assetSort==='change'?'desc':'asc';renderAssets();});
 $('#asset-sort-direction').addEventListener('click',()=>{assetSortDirection=assetSortDirection==='asc'?'desc':'asc';renderAssets();$('#asset-sort-direction').focus();});
 $('#asset-search').addEventListener('input',e=>{const pos=e.target.selectionStart;assetSearch=e.target.value;renderAssets();$('#asset-search').focus();$('#asset-search').setSelectionRange(pos,pos);});
}
function profileActions(i){
 const n=data.insights?.[i.id]||{},open=openInsights.has(i.id),personal=!!(i.watched||holdings(i.id).length);
 return `<div class="profile-action-bar"><button class="purchase-record-link" type="button" data-buy="${esc(i.id)}">＋ Zakup</button><button class="purchase-record-link" type="button" data-company-comment="${esc(i.id)}">＋ Komentarz</button><button class="purchase-record-link" type="button" data-toggle-insight="${esc(i.id)}" aria-expanded="${open}" aria-controls="profile-situation-${esc(i.id)}">Sytuacja <span class="insight-new" ${n.unread?'':'hidden'}>●</span><span aria-hidden="true">${open?'⌃':'⌄'}</span></button></div><section id="profile-situation-${esc(i.id)}" data-insight-region="${esc(i.id)}" ${open?'':'hidden'}>${insightBody({...i,personal},n)}</section>`;
}
function companyPanel(i,profile=false){
 const personal=!!(i.watched||holdings(i.id).length),n=data.insights?.[i.id]||{};
 return `<div class="company-tools"><details class="company-insight" data-insight="${esc(i.id)}" ${openInsights.has(i.id)?'open':''}><summary><span>Sytuacja ${i.type==='etf'?'ETF-u':'spółki'}</span><span class="insight-new" ${n.unread?'':'hidden'}>Nowe</span><span class="insight-chevron" aria-hidden="true">⌄</span></summary>${insightBody({...i,personal},n)}</details><button class="purchase-record-link company-comment" data-company-comment="${esc(i.id)}">＋ Komentarz</button></div>`;
}
function companyCard(i,{showTools=true}={}){return `<div class="company-card"><article class="asset-row"><button class="asset-name" data-instrument="${esc(i.id)}"><span class="logo-wrap" data-signal-owner="${esc(i.id)}"><span class="company-icon">${logo(i)}</span>${publicationSignal(i)}</span><span><strong>${esc(i.name)}</strong><small>${esc(i.ticker||i.group_name)}</small></span></button><div class="quote" data-instrument="${esc(i.id)}" role="button" tabindex="0" aria-label="Notowanie ${esc(i.name)}">${quote(i,true)}</div><button class="star ${i.watched?'selected':''}" data-watch="${esc(i.id)}" aria-label="${i.watched?'Usuń z obserwowanych':'Dodaj do obserwowanych'} ${esc(i.name)}" aria-pressed="${!!i.watched}">${i.watched?'★':'☆'}</button></article>${showTools?companyPanel(i):''}</div>`;}
async function acknowledgeInsight(id){
 const n=data.insights?.[id];if(!n?.unread||!n.material_hash)return;
 const result=await api('insight-read',{id,hash:n.material_hash});if(!result.ok)return;
 n.unread=false;const i=data.instruments.find(i=>i.id===id);if(i)i.insight_unread=false;
 document.querySelectorAll('[data-insight],[data-toggle-insight]').forEach(el=>{if((el.dataset.insight||el.dataset.toggleInsight)!==id)return;const badge=el.querySelector('.insight-new');if(badge)badge.hidden=true;});
 document.querySelectorAll(`[data-signal-owner="${CSS.escape(id)}"] .publication-signal`).forEach(el=>el.outerHTML=publicationSignal(i));
}
document.addEventListener('toggle',event=>{const el=event.target;if(!el.matches('details[data-insight]'))return;const id=el.dataset.insight;if(el.open){openInsights.add(id);acknowledgeInsight(id).catch(e=>toast(e.message));}else openInsights.delete(id);},true);
let insightRefreshBusy=false,insightRefreshCursor=0;
async function refreshOpenInsight(){
 if(insightRefreshBusy||document.hidden||!data||$('#shell').hidden)return;
 const root=$('#detail').open?$('#detail-body'):$('#view');
 const open=[...root.querySelectorAll($('#detail').open?'[data-insight-region],details[data-insight][open]':'details[data-insight][open]')];if(!open.length)return;
 const el=open[insightRefreshCursor++%open.length],id=el.dataset.insight||el.dataset.insightRegion;
 insightRefreshBusy=true;
 try{const {insight:n}=await api('insight?id='+encodeURIComponent(id));const old=data.insights?.[id];data.insights??={};data.insights[id]=n;
  const i=data.instruments.find(i=>i.id===id);if(i)i.insight_unread=n.unread;
  if(el.isConnected&&JSON.stringify(old)!==JSON.stringify(n)){const personal=!!(i.watched||holdings(id).length);el.querySelector('[data-insight-body]').outerHTML=insightBody({...i,personal},n);const brief=document.querySelector('[data-profile-brief="'+CSS.escape(id)+'"]');if(brief)brief.innerHTML=briefBody({...i,personal},n);}
  if(el.isConnected&&!el.hidden)await acknowledgeInsight(id);
 }catch{}finally{insightRefreshBusy=false;}
}
setInterval(()=>refreshOpenInsight(),15000);
async function companyPublications(id){
 activeInstrument=id;const i=data.instruments.find(i=>i.id===id);showDialog('<p>Wczytywanie publikacji…</p>');
 try{const result=await api('instrument-articles?id='+encodeURIComponent(id));if(activeInstrument!==id)return;applyInstrumentArticles(id,result.articles);
 showDialog(`<h2>Publikacje</h2><p>${esc(i.name)}</p><button class="back-link" data-back-profile="${esc(id)}">← Profil</button><div class="profile-publications-window article-scroll-window">${result.articles.map(a=>`<article class="profile-publication"><button class="publication-link" data-article="${esc(a.id)}"><small>${date(a.published_at)} · ${esc(a.source_name)}</small><strong>${esc(headline(a))}</strong></button></article>`).join('')||'<p>Brak zapisanych publikacji.</p>'}</div>`);
 }catch(error){showDialog(`<p>${esc(error.message)}</p><button class="back-link" data-back-profile="${esc(id)}">← Profil</button>`);}
}

function summaryButton(a,wrapped=true,compact=false){
 if(articleAccessUnavailable(a)){const message=compact?'<button class="secondary" disabled title="Nie mam dostępu do treści artykułu. Dostępny jest tylko nagłówek lub fragment — podsumowanie nie zostało wygenerowane.">Brak dostępu</button>':'<p class="home-note">Nie mam dostępu do treści artykułu, więc nie mogę go podsumować.</p>';return wrapped?`<span data-summary-slot="${esc(a.id)}" ${compact?'data-summary-compact="true"':''}>${message}</span>`:message;}
 if(compact){const content=a.summary?'<button class="secondary" disabled>Gotowe</button>':summaryNeedsRefresh(a)?`<button class="secondary" disabled>${a.job_status==='running'?'Generuję…':'W kolejce'}</button>`:a.job_status==='failed'?`<button class="secondary" data-summary-retry="${esc(a.id)}">Ponów</button>`:`<button class="secondary" data-summarize="${esc(a.id)}">Podsumuj</button>`;return wrapped?`<span class="inline-summary-slot" data-summary-slot="${esc(a.id)}" data-summary-compact="true">${content}</span>`:content;}
 const content=a.summary?`<button class="secondary" data-article="${esc(a.id)}">Czytaj podsumowanie AI</button>`:summaryNeedsRefresh(a)?`<p class="home-note">${a.job_status==='running'?'Powstaje podsumowanie…':'Podsumowanie w kolejce…'}</p>`:a.job_status==='failed'?`<button class="secondary" data-summary-retry="${esc(a.id)}">Ponów podsumowanie AI</button>`:`<button class="secondary" data-summarize="${esc(a.id)}">Generuj podsumowanie AI</button>`;
 return wrapped?`<div data-summary-slot="${esc(a.id)}">${content}</div>`:content;
}

async function instrumentDetail(id){activeInstrument=id;const i=data.instruments.find(i=>i.id===id);if(!i)return;showDialog('<p>Wczytywanie profilu…</p>');await refreshQuotes().catch(()=>{});try{const r=await api('insight?id='+encodeURIComponent(id));data.insights??={};data.insights[id]=r.insight;}catch(error){toast(error.message);}if(activeInstrument!==id)return;
 const profileStar=`<button class="profile-watch-star ${i.watched?'selected':''}" type="button" data-watch="${esc(id)}" aria-label="${i.watched?'Usuń z obserwowanych':'Dodaj do obserwowanych'} ${esc(i.name)}" aria-pressed="${!!i.watched}">${i.watched?'★':'☆'}</button>`;
 showDialog(`<div class="instrument-profile"><div class="profile-heading"><span class="logo-wrap" data-signal-owner="${esc(id)}"><span class="company-icon">${logo(i)}</span>${publicationSignal(i)}</span><div><span class="eyebrow">${i.type==='stock'?'AKCJA':'ETF'}</span><div class="profile-name-line"><h2>${esc(i.name)}</h2></div></div></div><div class="quote detail-quote profile-quote-with-star">${quote(i).replace('</strong>','</strong>'+profileStar)}</div>${profileActions(i)}<section id="profile-chart" aria-label="Wykres kursu"></section><section data-profile-brief="${esc(id)}">${briefBody({...i,personal:!!(i.watched||holdings(id).length)},data.insights?.[id])}</section><section id="profile-comments" aria-label="Twoje komentarze"></section><div class="profile-banner"><h3>Zakupy</h3></div>${holdings(id).map(p=>`<div class="source-row"><strong>${number(p.quantity)} szt. × ${money(p.price,p.currency)}</strong><p>${date(p.purchased_on+'T12:00:00Z')} · koszt ${money(p.quantity*p.price,p.currency)}</p><button class="text-button" data-delete-purchase="${p.id}" data-owner="${id}">Usuń błędny zapis</button></div>`).join('')||'<p>Brak zakupów</p>'}</div>`);
 const commentsTarget=$('#profile-comments');
 if(commentsTarget)api('instrument-comments?id='+encodeURIComponent(id)).then(r=>{
  if(activeInstrument!==id||!commentsTarget.isConnected)return;
  commentsTarget.innerHTML=r.comments.length?'<div class="profile-banner"><h3>Twoje komentarze</h3></div><div class="profile-comments-list">'+r.comments.map(c=>'<article class="personal-comment"><small>'+esc(fullDate(c.created_at))+'</small><p>'+esc(c.text)+'</p></article>').join('')+'</div>':'';
 }).catch(()=>{if(commentsTarget.isConnected)commentsTarget.innerHTML='<p class="error-text">Nie udało się wczytać komentarzy.</p>';});
 const chart=$('#profile-chart');if(chart)import('./price-chart.js?v=2').then(({mountPriceChart})=>{if(activeInstrument===id&&chart.isConnected)mountPriceChart(chart,id);}).catch(()=>{if(chart.isConnected)chart.textContent='Wykres będzie dostępny po wdrożeniu backendu.';});
}
async function commentForm(id){
 const i=data.instruments.find(i=>i.id===id);if(!i)return;
 showDialog('<p>Wczytywanie komentarzy…</p>');
 try{const r=await api('instrument-comments?id='+encodeURIComponent(id));
 showDialog('<h2>Komentarze</h2><p>'+esc(i.name)+'</p><form id="comment-form"><label for="comment-text">Twój komentarz</label><textarea id="comment-text" maxlength="5000" rows="4" required></textarea><button type="submit">Zapisz</button><p id="comment-error" role="alert"></p></form><div id="comment-list"></div><button class="text-button" data-instrument="'+esc(id)+'">Profil podmiotu</button>');
 const render=comments=>{$('#comment-list').innerHTML=comments.map(c=>'<article class="personal-comment"><small>'+esc(fullDate(c.created_at))+'</small><p>'+esc(c.text)+'</p><button class="text-button" data-remove-comment="'+esc(c.id)+'">Usuń</button></article>').join('')||'<p>Nie masz jeszcze komentarzy.</p>';};render(r.comments);
 $('#comment-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const r=await api('instrument-comments',{instrument_id:id,text:$('#comment-text').value});await instrumentDetail(id);toast('Komentarz zapisany.');}catch(e){$('#comment-error').textContent=e.message;}finally{button.disabled=false;}});
 $('#comment-list').addEventListener('click',async e=>{const b=e.target.closest('[data-remove-comment]');if(!b)return;try{const r=await api('instrument-comments',{instrument_id:id,delete_id:b.dataset.removeComment});render(r.comments);}catch(e){$('#comment-error').textContent=e.message;}});
 }catch(e){showDialog('<p role="alert">Nie udało się wczytać komentarzy. '+esc(e.message)+'</p><button class="text-button" data-instrument="'+esc(id)+'">Profil podmiotu</button>');}
}
function purchaseForm(id){const i=data.instruments.find(i=>i.id===id);showDialog(`<h2>Dodaj zakup</h2><p>${esc(i.name)}</p><form id="purchase-form" class="purchase-form"><label>Ilość<input name="quantity" type="number" min="0.000001" step="any" inputmode="decimal" required></label><label>Cena za sztukę<input name="price" type="number" min="0" step="any" inputmode="decimal" required></label><label>Waluta<select name="currency">${['USD','EUR','PLN','GBP','CHF'].map(c=>`<option ${c===(i.type==='etf'?'EUR':'USD')?'selected':''}>${c}</option>`).join('')}</select></label><label>Data zakupu<input name="purchased_on" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><p>Zapis w portfelu</p><button class="primary" type="submit">Zapisz zakup</button><p id="purchase-error" role="alert"></p></form>`);$('#purchase-form').addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.quantity=Number(b.quantity);b.price=Number(b.price);b.instrument_id=id;try{await api('purchase',b);await load();instrumentDetail(id);toast('Zakup zapisany.');}catch(err){$('#purchase-error').textContent=err.message;}});}

document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-instrument]')){e.preventDefault();instrumentDetail(e.target.dataset.instrument);}});

let chatAttachments=[],chatSupportsImages=false,chatPreparingImages=false;
function renderChatImages(){
 const target=$('#chat-attachments');if(!target)return;
 target.innerHTML=chatAttachments.map((url,index)=>`<div class="chat-attachment"><img src="${url}" alt="Załączone zdjęcie ${index+1}"><button type="button" class="secondary" data-remove-image="${index}" aria-label="Usuń zdjęcie ${index+1}">Usuń</button></div>`).join('');
 target.querySelectorAll('[data-remove-image]').forEach(button=>button.addEventListener('click',()=>{chatAttachments.splice(Number(button.dataset.removeImage),1);renderChatImages();}));
}
async function prepareChatImage(file,{maxEdge=1600,quality=.8}={}){
 if(!file.type.startsWith('image/')||file.size>20000000)throw Error('Wybierz zdjęcie do 20 MB');
 const bitmap=await createImageBitmap(file);
 try{const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const url=canvas.toDataURL('image/jpeg',quality);if(url.length>1400000)throw Error('Zdjęcie jest za duże — wybierz mniejsze');return url;}finally{bitmap.close();}
}
async function renderChat(){
 $('#view').innerHTML='<div class="chat-shell"><p class="home-note" id="chat-status">Łączenie…</p><div id="chat-login"></div><form id="chat-form" class="chat-form"><label class="home-note" for="chat-text">Wiadomość do Codexa</label><textarea id="chat-text" rows="3" maxlength="6000" placeholder="Co zmienić w Zorzy?"></textarea><div id="chat-attachments" class="chat-attachments"></div><div class="chat-compose-actions"><label class="secondary chat-image-picker">Dodaj zdjęcia<input id="chat-images" type="file" accept="image/*" multiple></label><small id="chat-image-status">Do 3 zdjęć · 20 MB/szt.</small><button class="secondary" id="chat-stop" type="button">Zatrzymaj</button><button class="primary" id="chat-send" type="submit">Wyślij</button></div></form><div id="chat-messages" class="chat-messages" aria-live="polite"></div></div>';
 renderChatImages();
 $('#chat-images').addEventListener('change',async e=>{if(chatPreparingImages)return;const files=[...e.target.files];if(files.length+chatAttachments.length>3){toast('Dodaj maksymalnie 3 zdjęcia');e.target.value='';return;}chatPreparingImages=true;try{const images=await Promise.all(files.map(prepareChatImage));chatAttachments.push(...images);renderChatImages();}catch(err){toast(err.message||'Nie można odczytać zdjęcia. Wybierz JPG, PNG lub WebP.');}finally{chatPreparingImages=false;e.target.value='';}});
 $('#chat-form').addEventListener('submit',async e=>{e.preventDefault();if(chatPreparingImages){toast('Poczekaj na przygotowanie zdjęć');return;}if(chatAttachments.length&&!chatSupportsImages){toast('Wysyłanie zdjęć wymaga publikacji backendu przez administratorkę');return;}const text=$('#chat-text').value;$('#chat-send').disabled=true;try{await api('chat/message',{text,images:chatAttachments});chatAttachments=[];renderChatImages();$('#chat-text').value='';await refreshChat();}catch(err){toast(err.message);$('#chat-send').disabled=false;}});
 $('#chat-stop').addEventListener('click',async()=>{try{await api('chat/stop',{});await refreshChat();}catch(e){toast(e.message);}});
 const deployPanel=document.createElement('section');deployPanel.className='settings-card deployment-panel';deployPanel.innerHTML='<h2>Backend</h2><p id="deployment-status" aria-live="polite" hidden></p><button class="primary" id="deployment-confirm" type="button" title="Wdróż sprawdzone zmiany" hidden>Wdrożenie</button>';
 $('#chat-form').before(deployPanel);
 $('#deployment-confirm').addEventListener('click',async()=>{try{const id=$('#deployment-confirm').dataset.version;$('#deployment-confirm').disabled=true;await api('deployment/deploy',{id});await refreshDeployment();}catch(e){toast(e.message);await refreshDeployment();}});
 await Promise.all([refreshChat(),refreshDeployment()]);
}
let deploymentLoadedVersion=null,deploymentRefreshing=false,deploymentCheckedChat=null,deploymentChatKey=null,deploymentChatBusy=true,deploymentRetryAt=0;
async function refreshDeployment(){
 if(tab!=='chat'||!$('#deployment-status')||deploymentRefreshing)return;
 deploymentRefreshing=true;
 try{let d=await api('deployment/status');
 if(d.phase==='succeeded'&&d.id&&deploymentLoadedVersion!==d.id){await load();deploymentLoadedVersion=d.id;}
 const busy=['preparing','testing','deploying'].includes(d.phase);
 if(d.enabled&&!busy&&d.phase!=='interrupted'&&!deploymentChatBusy&&deploymentChatKey!==null&&deploymentCheckedChat!==deploymentChatKey&&Date.now()>=deploymentRetryAt){
  try{d=await api('deployment/prepare',{});deploymentCheckedChat=deploymentChatKey;}catch(e){deploymentRetryAt=Date.now()+30000;throw e;}
 }
 if(tab!=='chat'||!$('#deployment-status'))return;
 const ready=d.phase==='ready'&&!deploymentChatBusy&&deploymentCheckedChat===deploymentChatKey;
 $('#deployment-status').textContent=d.message||'';
 $('#deployment-status').hidden=!['failed','rolled_back','interrupted','preparing','testing','deploying'].includes(d.phase);
 $('#deployment-confirm').hidden=!ready;$('#deployment-confirm').disabled=!ready;$('#deployment-confirm').dataset.version=d.id||'';
 }catch(e){if($('#deployment-confirm'))$('#deployment-confirm').hidden=true;if($('#deployment-status')){$('#deployment-status').textContent=e.message;$('#deployment-status').hidden=false;}}
 finally{deploymentRefreshing=false;}
}
async function refreshChat(){
 if(tab!=='chat'||!$('#chat-messages'))return;
 try{const r=await api('chat/status');if(tab!=='chat'||!$('#chat-messages'))return;
 $('#chat-status').textContent=!r.connected?'Codex nie jest jeszcze połączony':!r.authenticated?'Połącz swoje konto ChatGPT':r.publicationBusy?'Opracowanie prasówki…':r.running?'Codex pracuje…':`Gotowy · ${r.used||0}/${r.limit||300} wiadomości dzisiaj`;
 deploymentChatBusy=!!(r.running||r.publicationBusy);deploymentChatKey=JSON.stringify((r.messages||[]).map(m=>[m.role,m.id,m.text]));
 if(deploymentChatBusy&&$('#deployment-confirm'))$('#deployment-confirm').hidden=true;
 chatSupportsImages=r.attachments===true;$('#chat-image-status').textContent=chatSupportsImages?'Do 3 zdjęć · 20 MB/szt.':'Podgląd zdjęć dostępny · wysyłanie wymaga publikacji backendu';
 $('#chat-send').disabled=!r.connected||!r.authenticated||r.running||r.publicationBusy;$('#chat-stop').hidden=!r.running;
 $('#chat-messages').innerHTML=(r.messages||[]).filter(m=>!(m.role==='system'&&/zatrzyman/i.test(m.text||''))).reverse().map(m=>`<div class="chat-bubble ${m.role==='user'?'from-user':m.role==='assistant'?'from-codex':'chat-note'}"><strong>${m.role==='user'?'Ty':m.role==='assistant'?'Codex':'Status'}</strong><p>${esc(m.text)}</p>${(m.images||[]).filter(url=>typeof url==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)).map(url=>`<img class="chat-history-image" src="${url}" alt="Zdjęcie w wiadomości" loading="lazy">`).join('')}</div>`).join('');
 if(r.connected&&!r.authenticated){$('#chat-login').innerHTML=r.login?`<p>Kod: <strong>${esc(r.login.userCode)}</strong></p><a class="primary original-link" href="https://auth.openai.com/codex/device" target="_blank" rel="noopener noreferrer">Zaloguj do ChatGPT ↗</a>`:'<button class="primary" id="chat-connect">Połącz konto ChatGPT</button>';$('#chat-connect')?.addEventListener('click',async()=>{try{await api('chat/login',{});await refreshChat();}catch(e){toast(e.message);}});}else $('#chat-login').innerHTML='';
 }catch(e){if($('#chat-status'))$('#chat-status').textContent='Codex chwilowo niedostępny';}
}
setInterval(()=>{if(tab==='chat'&&!document.hidden){refreshChat();refreshDeployment();}},3000);
