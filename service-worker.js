const CACHE='kazior-crm-v19-20260912-fixes';
const ASSETS=['./','./index.html','./styles.css','./shared.css','./app.js','./ncalayer.js','./v16-ui.js','./v17-ui.js','./v18-ui.js','./v19-ui.js','./whatsapp-core.js','./manifest.json','./assets/logo.jpeg','./assets/kazior-logo.png','./assets/kazior-favicon.png','./assets/kazior-app-icon-192.png','./assets/kazior-app-icon-512.png','./assets/team-aizhan.jpg','./assets/team-alma.jpg','./assets/team-altair.jpg','./assets/team-elnur.jpg','./assets/team-evgeniy.jpg','./assets/team-kuanysh.jpg','./assets/author-signature.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kazior-crm-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  const assetPaths=ASSETS.map(asset=>new URL(asset,self.registration.scope).pathname);
  if(!assetPaths.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
