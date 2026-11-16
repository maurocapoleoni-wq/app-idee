// Avvio dell'app, navigazione tra le schermate e invio della coda verso la cassetta.

import { leggiConfig, campiMancanti } from './config.js';
import { creaCoda, memoriaIndexedDB } from './coda.js';
import { creaArchivio } from './archivio.js';
import { creaGithub } from './github.js';
import { assicuraIdea, salvataggiDelDialogo } from './dialogo.js';
import { ideeEsempio } from './esempi.js';
import { SCHEDE } from './idee.js';
import * as home from './ui/home.js';
import * as conversazione from './ui/conversazione.js';
import * as idea from './ui/idea.js';
import * as impostazioni from './ui/impostazioni.js';

const SCHERMATE = { home, conversazione, idea, impostazioni };

const stato = {
  config: leggiConfig(),
  dialoghi: [],
  idee: [],
  esempi: true,
  scheda: SCHEDE.ATTIVE,
  pagina: 1,
  coda: creaCoda(memoriaIndexedDB('raccoglitore-idee', 'coda')),
};
const archivio = creaArchivio(memoriaIndexedDB('raccoglitore-idee', 'dialoghi'));

const contenitore = document.getElementById('app');

async function ricaricaIdee() {
  try {
    stato.dialoghi = await archivio.tutti();
  } catch {
    stato.dialoghi = [];
  }
  const vere = stato.dialoghi.filter((d) => d.idea).map((d) => d.idea);
  stato.esempi = vere.length === 0;
  stato.idee = stato.esempi ? ideeEsempio() : vere;
}

// Regola 2: prima il telefono (archivio), poi la coda, poi GitHub.
async function salvaDialogo(dialogo) {
  await archivio.salva(dialogo);
  for (const file of salvataggiDelDialogo(dialogo)) await stato.coda.aggiungi(file);
  await ricaricaIdee();
  aggiornaIndicatore();
  inviaCoda();
}

let ultimoErrore = null;

async function inviaCoda() {
  if (campiMancanti(stato.config).length || !navigator.onLine) {
    aggiornaIndicatore();
    return;
  }
  try {
    const { github_token: token, github_owner: owner, github_repo: repo } = stato.config;
    const gh = creaGithub({ token, owner, repo });
    const esito = await stato.coda.invia((el) => gh.scriviFile(el.percorso, el.contenuto, el.messaggio));
    ultimoErrore = esito.errore ?? null;
  } catch (e) {
    ultimoErrore = e;
  }
  aggiornaIndicatore();
}

function vai(nome, parametri = {}) {
  const schermata = SCHERMATE[nome] ?? home;
  contenitore.innerHTML = '';
  schermata.mostra(contenitore, { stato, vai, parametri, aggiornaIndicatore, salvaDialogo, inviaCoda });
  aggiornaIndicatore();
  window.scrollTo(0, 0);
}

async function aggiornaIndicatore() {
  const el = document.getElementById('indicatore');
  if (!el) return;
  el.title = '';
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
  if (inAttesa === 0) {
    el.className = 'indicatore ok';
    el.textContent = 'Salvato su GitHub';
  } else if (!navigator.onLine || ultimoErrore instanceof TypeError) {
    el.className = 'indicatore attesa';
    el.textContent = `In attesa di rete (${inAttesa})`;
  } else if (ultimoErrore) {
    // Nessun errore in silenzio: il dettaglio è nel tooltip e nelle Impostazioni.
    el.className = 'indicatore config';
    el.textContent = `Invio non riuscito (${inAttesa})`;
    el.title = String(ultimoErrore.message ?? ultimoErrore);
  } else {
    el.className = 'indicatore attesa';
    el.textContent = `Invio in corso (${inAttesa})`;
  }
}

window.addEventListener('online', inviaCoda);
window.addEventListener('offline', aggiornaIndicatore);
// Riprova periodica: copre reti instabili e errori temporanei di GitHub.
setInterval(async () => {
  if ((await stato.coda.inAttesa().catch(() => 0)) > 0) inviaCoda();
}, 60_000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* senza service worker l'app funziona lo stesso, solo non offline */
  });
}

async function avvia() {
  await ricaricaIdee();
  // Un dialogo rimasto senza idea (app chiusa mentre Claude rispondeva) riceve un titolo provvisorio.
  const usati = stato.dialoghi.filter((d) => d.idea).map((d) => d.idea.id);
  for (const d of stato.dialoghi.filter((x) => !x.idea && x.messaggi.length)) {
    const conIdea = assicuraIdea(d, { idEsistenti: usati });
    usati.push(conIdea.idea.id);
    await salvaDialogo(conIdea);
  }
  vai(campiMancanti(stato.config).length && !localStorage.getItem('raccoglitore-idee:visto') ? 'impostazioni' : 'home');
  localStorage.setItem('raccoglitore-idee:visto', '1');
  inviaCoda();
}

avvia();
