const CACHE='zorza-shell-v4';
const FILES=['/','/price-chart.js','/app.js','/portfolio.js','/style.css','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  // Dane prywatne i odpowiedzi API nigdy nie trafiają do cache offline.
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||!FILES.includes(u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));
});
