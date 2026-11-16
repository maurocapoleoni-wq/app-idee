// Service worker: tiene in cache i file dell'app così si apre anche senza rete.
// Le chiamate alle API (GitHub, Anthropic, YouTube) non passano mai dalla cache.
// Aumentare VERSIONE a ogni rilascio per aggiornare la cache sui telefoni.

const VERSIONE = 'idee-v11';
const FILE_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icona.svg',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/idee.js',
  './js/cassetta.js',
  './js/coda.js',
  './js/dialogo.js',
  './js/archivio.js',
  './js/sincronia.js',
  './js/github.js',
  './js/claude.js',
  './js/voce.js',
  './js/youtube.js',
  './js/condividi.js',
  './js/esempi.js',
  './js/ui/dom.js',
  './js/ui/stile-stati.js',
  './js/ui/home.js',
  './js/ui/conversazione.js',
  './js/ui/idea.js',
  './js/ui/scheda.js',
  './js/ui/dettatura.js',
  './js/ui/miglioria.js',
  './js/ui/impostazioni.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE_APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Rete prima, cache come riserva: con la rete si ha sempre la versione aggiornata.
  // cache 'no-cache' scavalca la cache HTTP (GitHub Pages la tiene 10 minuti): senza,
  // dopo un aggiornamento si potrebbero mescolare moduli nuovi e vecchi.
  evento.respondWith(
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
      .then((risposta) => {
        const copia = risposta.clone();
        caches.open(VERSIONE).then((c) => c.put(evento.request, copia));
        return risposta;
      })
      .catch(() => caches.match(evento.request)),
  );
});
