// Avvio dell'app, navigazione tra le schermate e invio della coda verso la cassetta.

import { leggiConfig, campiMancanti } from './config.js';
import { creaCoda, memoriaIndexedDB } from './coda.js';
import { creaArchivio } from './archivio.js';
import { creaGithub } from './github.js';
import { assicuraIdea, salvataggioDelDialogo } from './dialogo.js';
import { leggiStatoJson, leggiSchedaMd, leggiConversazioneMd } from './cassetta.js';
import { serveDettaglio, unisciDaCassetta } from './sincronia.js';
import { ideeEsempio } from './esempi.js';
import { SCHEDE } from './idee.js';
import * as home from './ui/home.js';
import * as conversazione from './ui/conversazione.js';
import * as idea from './ui/idea.js';
import * as impostazioni from './ui/impostazioni.js';
import * as miglioria from './ui/miglioria.js';

const SCHERMATE = { home, conversazione, idea, impostazioni, miglioria };

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
// Con { cassetta: false } resta solo sul telefono (es. bozza di una miglioria).
async function salvaDialogo(dialogo, { cassetta = true, soloStato = false, azione } = {}) {
  await archivio.salva(dialogo);
  const salvataggio = cassetta ? salvataggioDelDialogo(dialogo, { soloStato, azione }) : null;
  if (salvataggio) await stato.coda.aggiungi(salvataggio);
  await ricaricaIdee();
  aggiornaIndicatore();
  if (salvataggio) inviaCoda();
}

let ultimoErrore = null;

function github() {
  const { github_token: token, github_owner: owner, github_repo: repo } = stato.config;
  return creaGithub({ token, owner, repo });
}

async function inviaCoda() {
  if (campiMancanti(stato.config).length || !navigator.onLine) {
    aggiornaIndicatore();
    return;
  }
  try {
    const gh = github();
    const esito = await stato.coda.invia((el) => gh.scriviCommit(el.files, el.messaggio));
    ultimoErrore = esito.errore ?? null;
  } catch (e) {
    ultimoErrore = e;
  }
  aggiornaIndicatore();
}

// Rilegge la cassetta: stati cambiati dal PC, idee salvate da un altro browser.
let sincronizzando = null;
function sincronizza() {
  if (sincronizzando || campiMancanti(stato.config).length || !navigator.onLine) return sincronizzando;
  sincronizzando = (async () => {
    let cambiate = 0;
    try {
      const gh = github();
      const cartelle = await gh.elencaCartelle();
      const inCoda = new Set((await stato.coda.elementi()).map((e) => e.chiave));
      const remote = await Promise.all(cartelle.map(async (id) => {
        try {
          const f = await gh.leggiFile(`${id}/stato.json`);
          return f ? leggiStatoJson(f.contenuto, id) : null;
        } catch {
          return null; // cartella che non è un'idea (o stato.json rovinato): si ignora
        }
      }));
      for (const idea of remote.filter(Boolean)) {
        let scheda;
        let messaggi;
        if (serveDettaglio(stato.dialoghi, idea)) {
          const [s, c] = await Promise.all([
            gh.leggiFile(`${idea.id}/scheda.md`),
            gh.leggiFile(`${idea.id}/conversazione.md`),
          ]);
          scheda = s ? leggiSchedaMd(s.contenuto) : undefined;
          messaggi = c ? leggiConversazioneMd(c.contenuto) : undefined;
        }
        // Si rilegge l'archivio appena prima di scrivere: un salvataggio locale nel frattempo vince.
        const aggiornato = unisciDaCassetta(await archivio.tutti(), { idea, scheda, messaggi }, { inCoda });
        if (aggiornato) {
          await archivio.salva(aggiornato);
          cambiate += 1;
        }
      }
    } catch {
      /* lettura non riuscita: si riprova al prossimo avvio o al ritorno della rete */
    } finally {
      sincronizzando = null;
    }
    if (cambiate) {
      await ricaricaIdee();
      if (corrente.nome === 'home') vai('home');
    }
  })();
  return sincronizzando;
}

const corrente = { nome: null };

function vai(nome, parametri = {}) {
  const schermata = SCHERMATE[nome] ?? home;
  corrente.nome = SCHERMATE[nome] ? nome : 'home';
  contenitore.innerHTML = '';
  schermata.mostra(contenitore, { stato, vai, parametri, aggiornaIndicatore, salvaDialogo, inviaCoda, sincronizza });
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

window.addEventListener('online', async () => {
  await inviaCoda(); // prima si manda ciò che il telefono ha in sospeso, poi si rilegge
  sincronizza();
});
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
  await inviaCoda();
  sincronizza();
}

avvia();
