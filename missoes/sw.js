// Gerado por ferramentas/montar-publicacao.js. Guarda os arquivos para abrir sem internet; a versão muda quando qualquer arquivo muda.
var VERSAO = 'missoes-e6f6dfe80676';
var ARQUIVOS = ['./',"./app.js","./calculo.js","./icone-192.png","./icone-512.png","./index.html","./manifest.webmanifest","./missoes.css","./registrar-sw.js","./style.css"];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); })); });
