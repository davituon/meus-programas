// Registra o service worker (só em http/https; abrir o arquivo direto do disco continua funcionando sem ele).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
