const money=(value,currency)=>new Intl.NumberFormat('pl-PL',{style:'currency',currency,maximumFractionDigits:2}).format(value);
const date=(value,period)=>new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'short',...(period==='1d'||period==='1w'?{hour:'2-digit',minute:'2-digit'}:{year:'numeric'}),timeZone:'Europe/Warsaw'}).format(new Date(value));
const el=(name,attributes={})=>{const node=document.createElement(name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;};
const svgEl=(name,attributes={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;};
export function chartGeometry(points,width=360,height=180){
 const valid=points.filter(p=>Number.isFinite(p.value));if(valid.length<2)return null;
 const values=valid.map(p=>p.value),minimum=Math.min(...values),maximum=Math.max(...values),padding=Math.max((maximum-minimum)*.12,maximum*.001,1e-6),lo=minimum-padding,hi=maximum+padding;
 const positions=points.map((p,index)=>Number.isFinite(p.value)?{...p,x:12+index/(points.length-1)*(width-24),y:12+(hi-p.value)/(hi-lo)*(height-24)}:null);
 let drawing=false;const path=positions.map(p=>{if(!p){drawing=false;return '';}const letter=drawing?'L':'M';drawing=true;return letter+p.x.toFixed(2)+','+p.y.toFixed(2);}).join(' ');
 return {positions,path,minimum,maximum,width,height};
}

export function mountPriceChart(container,instrumentId,{request=async(id,period)=>{const r=await fetch('/api/price-history?id='+encodeURIComponent(id)+'&period='+period);const d=await r.json();if(!r.ok)throw Error(d.error||'Nie można pobrać wykresu');return d;}}={}){
 let sequence=0,period='1d';
 container.classList.add('price-chart');container.setAttribute('aria-label','Wykres notowań');
 const controls=el('div',{class:'chart-ranges',role:'group','aria-label':'Zakres wykresu'}),display=el('div',{class:'chart-display','aria-live':'polite'});
 for(const [key,label,title] of [['1d','1D','1 dzień'],['1w','1T','Tydzień · 5 sesji'],['1y','1R','1 rok'],['5y','5L','5 lat']]){
  const button=el('button',{type:'button',class:'secondary','aria-label':title,'aria-pressed':String(key===period)});button.textContent=label;button.addEventListener('click',()=>load(key));button.dataset.period=key;controls.append(button);
 }
 container.replaceChildren(controls,display);
 async function load(next){
  period=next;const current=++sequence;
  controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
  display.textContent='Wczytywanie wykresu…';display.setAttribute('aria-busy','true');
  try{const data=await request(instrumentId,period);if(current!==sequence||!container.isConnected)return;render(data);}catch(e){if(current===sequence)display.textContent=e.message||'Brak danych wykresu';}finally{if(current===sequence)display.setAttribute('aria-busy','false');}
 }
 function render(data){
  const geometry=chartGeometry(data.points);if(!geometry){display.textContent='Za mało danych do wykresu';return;}
  const valid=geometry.positions.filter(Boolean),last=valid.at(-1),summary=el('div',{class:'chart-summary'}),value=el('strong'),stamp=el('small'),change=el('span',{class:data.change_percent>=0?'gain':'loss'});
  value.textContent=money(last.value,data.currency);stamp.textContent=date(last.time,data.period);change.textContent=(data.change_percent>=0?'+':'')+new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(data.change_percent)+'%';summary.append(value,change,stamp);
  const canvas=svgEl('svg',{viewBox:'0 0 360 180',class:'chart-svg',role:'img','aria-label':'Przebieg kursu. Wskaż punkt poniższym suwakiem.'});
  for(const y of [24,90,156])canvas.append(svgEl('line',{x1:12,x2:348,y1:y,y2:y,class:'chart-grid'}));
  canvas.append(svgEl('path',{d:geometry.path,fill:'none',class:data.change_percent>=0?'chart-line positive':'chart-line negative'}));
  const guide=svgEl('line',{y1:12,y2:168,class:'chart-guide'}),dot=svgEl('circle',{r:4,class:'chart-dot'});canvas.append(guide,dot);
  const axis=el('div',{class:'chart-axis'}),from=el('small'),to=el('small');from.textContent=date(valid[0].time,data.period);to.textContent=date(last.time,data.period);axis.append(from,to);
  const scale=el('div',{class:'chart-axis chart-price-scale'});scale.textContent=money(geometry.minimum,data.currency)+' — '+money(geometry.maximum,data.currency);
  const slider=el('input',{type:'range',min:0,max:valid.length-1,step:1,value:valid.length-1,class:'chart-point-slider','aria-label':'Cena i data punktu na wykresie'});
  change.title=data.period==='1d'?'Od poprzedniego zamknięcia':'Od początku dostępnego wykresu';
  function select(index){const point=valid[index],percent=(point.value/data.baseline-1)*100;value.textContent=money(point.value,data.currency);stamp.textContent=(data.interval==='1wk'?'Tydzień od ':'')+date(point.time,data.period);change.textContent=(percent>=0?'+':'')+new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(percent)+'%';change.className=percent>=0?'gain':'loss';guide.setAttribute('x1',point.x);guide.setAttribute('x2',point.x);dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);slider.value=index;slider.setAttribute('aria-valuetext',value.textContent+' · '+stamp.textContent);}
  slider.addEventListener('input',()=>select(Number(slider.value)));
  function point(event){const rectangle=canvas.getBoundingClientRect(),x=(event.clientX-rectangle.left)/rectangle.width*360;let nearest=0;for(let i=1;i<valid.length;i++)if(Math.abs(valid[i].x-x)<Math.abs(valid[nearest].x-x))nearest=i;select(nearest);}
  canvas.addEventListener('pointerdown',event=>{point(event);canvas.setPointerCapture?.(event.pointerId);});canvas.addEventListener('pointermove',event=>{if(canvas.hasPointerCapture?.(event.pointerId)||event.pointerType==='mouse')point(event);});
  const note=el('p',{class:'chart-note'});note.textContent=(data.stale?'Zapisane dane · ':'')+'Yahoo Finance · możliwe opóźnienie · kurs bez dywidend';
  if(data.warning)note.textContent+=' · '+data.warning;
  const pointLabel=el('small',{class:'chart-point-label'});pointLabel.textContent='Cena punktu na wykresie';display.replaceChildren(pointLabel,summary,canvas,axis,slider,scale,note);select(valid.length-1);
 }
 load(period);
 return ()=>{sequence++;};
}
