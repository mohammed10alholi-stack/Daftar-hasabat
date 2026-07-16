/* خدمة العمل أوفلاين — دفتر الحسابات */
const CACHE = "daftar-v15";
const ASSETS = [
  "./","./index.html","./styles.css","./app.js","./manifest.webmanifest",
  "./icon-180.png","./icon-192.png","./icon-512.png",
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

// كاش أولاً = فتح فوري. وبنفس الوقت بنجيب النسخة الجديدة بالخلفية للفتحة الجاية.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // اترك طلبات الخارج للمتصفح

  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndUpdate = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || caches.match("./index.html"));
      // لو في نسخة بالكاش رجّعها فوراً (سريع)، وحدّث بالخلفية
      return cached || fetchAndUpdate;
    })
  );
});

// يسمح للتطبيق يطلب تفعيل التحديث فوراً
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
