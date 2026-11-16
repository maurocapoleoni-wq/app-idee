// Avvio dell'app e navigazione tra le schermate.

import { leggiConfig, campiMancanti } from './config.js';
import { creaCoda, memoriaIndexedDB } from './coda.js';
import { ideeEsempio } from './esempi.js';
import { SCHEDE } from './idee.js';
import * as home from './ui/home.js';
import * as conversazione from './ui/conversazione.js';
import * as idea from './ui/idea.js';
import * as impostazioni from './ui/impostazioni.js';

const SCHERMATE = { home, conversazione, idea, impostazioni };

const stato = {
  config: leggiConfig(),
  idee: ideeEsempio(),
  scheda: SCHEDE.ATTIVE,
  pagina: 1,
  coda: creaCoda(memoriaIndexedDB()),
};

const contenitore = document.getElementById('app');

function vai(nome, parametri = {}) {
  const schermata = SCHERMATE[nome] ?? home;
  contenitore.innerHTML = '';
  schermata.mostra(contenitore, { stato, vai, parametri, aggiornaIndicatore });
  aggiornaIndicatore();
  window.scrollTo(0, 0);
}

async function aggiornaIndicatore() {
  const el = document.getElementById('indicatore');
  if (!el) return;
  if (campiMancanti(stato.config).length) {
    el.className = 'indicatore config';
    el.textContent = 'Da configurare';
    return;
  }
  let inAttesa = 0;
  try {
    inAttesa = await stato.coda.inAttesa();
  } catch {
    /* IndexedDB non disponibile: l'indicatore resta neutro */
  }
  if (inAttesa > 0) {
    el.className = 'indicatore attesa';
    el.textContent = navigator.onLine ? `Invio in corso (${inAttesa})` : `In attesa di rete (${inAttesa})`;
  } else {
    el.className = 'indicatore ok';
    el.textContent = 'Salvato su GitHub';
  }
}

window.addEventListener('online', aggiornaIndicatore);
window.addEventListener('offline', aggiornaIndicatore);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* senza service worker l'app funziona lo stesso, solo non offline */
  });
}

vai(campiMancanti(stato.config).length && !localStorage.getItem('raccoglitore-idee:visto') ? 'impostazioni' : 'home');
localStorage.setItem('raccoglitore-idee:visto', '1');
