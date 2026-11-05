// Gest zaczyna się tylko w uchwycie/nagłówku, nigdy w przewijanej treści.
export function installCardDismiss(dialog){
 let gesture=null,animation=null;
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clearGesture(){
  const old=gesture;gesture=null;
  if(old&&dialog.hasPointerCapture?.(old.id))dialog.releasePointerCapture(old.id);
  dialog.classList.remove('card-dragging');dialog.style.removeProperty('transform');
 }
 function reset(){
  const old=animation;animation=null;old?.cancel();clearGesture();dialog.classList.remove('card-closing');
  const body=dialog.querySelector('#detail-body')||dialog;
  if(!body.querySelector('.card-dismiss-handle')){
   const handle=document.createElement('div');handle.className='card-dismiss-handle';
   handle.dataset.swipeClose='';handle.setAttribute('aria-hidden','true');
   handle.innerHTML='<span></span>';body.prepend(handle);
  }
  body.querySelectorAll('.profile-heading,.modal-close-row').forEach(el=>el.dataset.swipeClose='');
 }
 function close(){
  if(!dialog.open||animation)return;
  const from=gesture?.offset||0;clearGesture();
  if(reduced()){dialog.close();return;}
  dialog.classList.add('card-closing');
  const exit=dialog.animate([
   {transform:`translateY(${from}px)`,opacity:1},
   {transform:`translateY(-${window.innerHeight}px)`,opacity:0}
  ],{duration:260,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  animation=exit;
  exit.finished.then(()=>{if(animation!==exit)return;dialog.close();}).catch(()=>{}).finally(()=>{
   if(animation===exit){animation=null;exit.cancel();}
  });
 }
 function restore(){
  const from=gesture?.offset||0;clearGesture();
  if(from&&!reduced()){
   const snap=dialog.animate([{transform:`translateY(${from}px)`},{transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
   animation=snap;snap.finished.catch(()=>{}).finally(()=>{if(animation===snap)animation=null;});
  }
 }
 dialog.addEventListener('pointerdown',e=>{
  if(!dialog.open||animation)return;
  if(e.isPrimary===false){restore();return;}
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const target=e.target;
  if(!target.closest?.('[data-swipe-close]')||target.closest('button,a,input,textarea,select,[contenteditable]'))return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,started:e.timeStamp,offset:0};
  dialog.setPointerCapture(e.pointerId);
 });
 dialog.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(Math.abs(dx)>18&&Math.abs(dx)>Math.abs(dy)){restore();return;}
  gesture.offset=Math.min(0,Math.max(-240,dy));
  if(dy<-10){dialog.classList.add('card-dragging');dialog.style.transform=`translateY(${gesture.offset}px)`;}
 });
 dialog.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=Math.abs(e.clientX-gesture.x),dy=e.clientY-gesture.y;
  if(dy<=-80&&-dy>dx*1.5&&e.timeStamp-gesture.started<1500)close();else restore();
 });
 dialog.addEventListener('pointercancel',restore);
 dialog.addEventListener('lostpointercapture',()=>{if(gesture)restore();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{const old=animation;animation=null;old?.cancel();clearGesture();dialog.classList.remove('card-closing');});
 return {close,reset};
}
