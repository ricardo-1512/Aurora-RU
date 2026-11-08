/* AURORA X Service Worker: App offline startbar machen, Live-Daten nie aus dem Cache */
const CACHE = "aurorax-v10.1";
const SHELL = ["./Index.html", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-192.png"];
const LIB_HOSTS = ["cdn.tailwindcss.com", "unpkg.com", "cdn.jsdelivr.net", "server.arcgisonline.com", "tile.openstreetmap.org"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  // Seite: immer zuerst Netz (damit Änderungen sofort ankommen), offline aus dem Cache
  if(req.mode === "navigate"){
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./Index.html"))));
    return;
  }

  // Bibliotheken und Kartenkacheln: aus dem Cache, im Hintergrund auffrischen
  if(LIB_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h)) || url.origin === self.location.origin){
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if(res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Alles andere (Live-Daten) normal übers Netz
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
    for(const c of list) if("focus" in c) return c.focus();
    return self.clients.openWindow("./Index.html");
  }));
});
