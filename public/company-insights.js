const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'';
export function eventDateLabel(e){
 const value=e.date||e.event_date,precision=e.precision||e.date_precision||'day';if(!value)return '';
 const d=new Date(value+'T12:00:00Z'),year=d.getUTCFullYear(),month=d.getUTCMonth();
 if(precision==='month')return new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',month:'long',year:'numeric'}).format(d);
 if(precision==='quarter')return Math.floor(month/3)+1+' kwartał '+year;
 if(precision==='half')return (month<6?'I':'II')+' półrocze '+year;
 if(precision==='year')return String(year);
 return new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',day:'numeric',month:'long',year:'numeric'}).format(d);
}
const href=url=>{try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?esc(u.href):'#';}catch{return '#';}};
function citations(n,ids){return [...new Set(ids||[])].map(id=>{const index=(n.sources||[]).findIndex(s=>s.id===id),s=n.sources?.[index];return s?`<a class="insight-citation" href="${href(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="Źródło: ${esc(s.publisher)}">[${index+1}]</a>`:'';}).join(' ');}
const prose=value=>String(value||'').replace(/\[\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*\]/gi,'').replace(/ {2,}/g,' ').trim();
function paragraph(n,items,label=''){if(!items?.length)return '';return `<p class="insight-paragraph">${label?`<strong>${label}</strong> `:''}${items.map(x=>`${esc(prose(x.text))} ${citations(n,x.sources)}`).join(' ')}</p>`;}
function factors(n,items,label){if(!items?.length)return '';return `<section class="situation-factors"><h4>${label}</h4><ul>${items.map(x=>{const text=prose(x.text),colon=text.indexOf(':');return `<li>${colon>0&&colon<80?`<strong>${esc(text.slice(0,colon))}:</strong> ${esc(text.slice(colon+1).trim())}`:esc(text)} ${citations(n,x.sources)}</li>`;}).join('')}</ul></section>`;}
export function insightBody(i,n={}){
 if(!i.personal)return `<div class="insight-body" data-insight-body="${esc(i.id)}"><p class="home-note">Dodaj do obserwowanych, aby włączyć monitoring.</p></div>`;
 const c=n.content;
 return `<div class="insight-body" data-insight-body="${esc(i.id)}">${n.generated_at?`<small class="insight-time insight-updated">${n.stale?'Poprzedni opis':'Opis zaktualizowano'} <time datetime="${esc(n.generated_at)}">${date(n.generated_at)}</time></small>`:''}${n.checked_at&&(!n.generated_at||Date.parse(n.checked_at)>Date.parse(n.generated_at))?`<small class="insight-time">Źródła sprawdzono <time datetime="${esc(n.checked_at)}">${date(n.checked_at)}</time></small>`:''}${['queued','running'].includes(n.status)?'<p class="home-note" role="status">Aktualizacja w kolejce…</p>':''}${n.status==='failed'?`<p class="error-text">${esc(n.error||'Nie udało się opracować opisu.')}</p><button class="secondary" data-insight-retry="${esc(i.id)}">Ponów opis</button>`:''}${c?`${paragraph(n,[c.overview])}${factors(n,c.drivers,'Główne czynniki')}${factors(n,c.risks,'Ryzyka')}${c.situation_dates?.length?factors(n,c.situation_dates.map(x=>({...x,text:eventDateLabel(x)+' · '+x.text})),'Najbliższe terminy'):''}${c.conclusion?paragraph(n,[c.conclusion]):''}${c.followups?.length?`<details class="insight-followups"><summary>Co można sprawdzić dalej</summary><ul>${c.followups.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}${c.price_context?`<p class="home-note">${esc(prose(c.price_context))}</p>`:''}${c.limitations?`<small class="insight-time">${esc(prose(c.limitations))}</small>`:''}`:`<p class="home-note">${n.stale?'Opis wymaga aktualizacji źródeł.':'Brak nowych materiałów od włączenia monitoringu.'}</p>`}</div>`;
}
export function briefBody(i,n={}){
 const c=n.content;
 const list=(key,label)=>c?.[key]?.length?`<section class="insight-section"><h4>${label}</h4><ul>${c[key].map(x=>`<li>${x.date?`<strong>${esc(eventDateLabel(x))}${x.certainty==='estimated'?' · szacunkowo':''}</strong> · `:''}${esc(prose(x.text))} ${citations(n,x.sources)}</li>`).join('')}</ul></section>`:'';
 const any=c&&['events','deadlines','actions'].some(k=>c[k]?.length);
 const waiting=['queued','running'].includes(n.status);
 const empty=waiting?'<p class="home-note" role="status">Przygotowuję brief…</p>':n.status==='failed'?`<p class="home-note">Nie udało się przygotować briefu.</p><button class="secondary" data-insight-retry="${esc(i.id)}">Ponów opracowanie</button>`:n.status==='done'?`<p class="home-note">Opracowanie nie dodało punktów briefu.</p><button class="secondary" data-insight-retry="${esc(i.id)}">Uzupełnij brief</button>`:'<p class="home-note">Brak nowych materiałów od włączenia monitoringu.</p>';
 return `<section class="profile-press-brief" aria-label="Brief prasowy"><div class="brief-heading"><h3>Brief prasowy</h3><span>6 miesięcy</span></div>${i.personal?any?list('events','Wydarzenia')+list('deadlines','Terminy')+list('actions','Działania'):empty:'<p class="home-note">Monitoring po dodaniu do obserwowanych lub portfela.</p>'}<button class="secondary all-publications" data-company-publications="${esc(i.id)}">Wszystkie publikacje →</button></section>`;
}
