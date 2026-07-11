/* خدمة العمل أوفلاين — دفتر الحسابات */
const CACHE = "daftar-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* الكود (html/css/js) = الشبكة أولاً حتى يوصل التحديث فوراً بدون حذف.
   الباقي (أيقونات...) = الكاش أولاً للسرعة. */
function isCode(url){
  return url.endsWith("/") || url.endsWith("index.html") || url.endsWith("app.js")
      || url.endsWith("styles.css") || url.endsWith("manifest.webmanifest");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isCode(url.pathname)) {
    // شبكة أولاً: جيب الأحدث، وخزّنه، ولو ما في نت ارجع للكاش
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // باقي الملفات: كاش أولاً
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
