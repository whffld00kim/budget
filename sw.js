const CACHE = 'gaegybu-v20260412';
const ASSETS = ['./', './index.html', './css/style.css', './js/app.js', './manifest.json'];

// 설치: 핵심 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting(); // 즉시 활성화
});

// 활성화: 이전 캐시 삭제 후 클라이언트 즉시 장악
// → controllerchange 이벤트 발생 → 페이지 자동 새로고침
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 요청: 네트워크 우선, 실패 시 캐시 사용
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
