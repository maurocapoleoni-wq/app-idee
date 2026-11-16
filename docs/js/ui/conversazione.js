// Schermata conversazione: l'utente racconta l'idea a voce o per iscritto,
// Haiku fa una domanda alla volta e la scheda si costruisce mentre si parla.
// Regola 2: ogni risposta dell'utente viene salvata in locale PRIMA di chiamare Claude.

import {
  nuovoDialogo, aggiungiMessaggio, attendeDomanda, normalizzaRisposta, assicuraIdea, applicaRisposta,
} from '../dialogo.js';
import { cambiaStato, STATI } from '../idee.js';
import { creaClaude } from '../claude.js';
import { voceSupportata, creaRiconoscimento, leggiAdAltaVoce } from '../voce.js';
import { esc, ICONE } from './dom.js';
import { schedaHtml } from './scheda.js';

const PREFISSO = 'raccoglitore-idee:';
const BENVENUTO = 'Raccontami la tua idea: che app ti piacerebbe avere, e per fare cosa?';

const leggiPreferenzaVoce = () => localStorage.getItem(`${PREFISSO}leggi-domande`) !== '0';

export async function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  let dialogo = (parametri.chiave && stato.dialoghi.find((d) => d.chiave === parametri.chiave))
    || nuovoDialogo(crypto.randomUUID());
  const chiaveBozza = `${PREFISSO}bozza:${dialogo.chiave}`;
  let occupato = false;
  let avviso = '';
  let ascolto = null;
  let inviaAllaFine = false;
  let leggiDomande = leggiPreferenzaVoce();

  radice.innerHTML = `
    <header class="barra">
      <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
      <h1 id="titolo"></h1>
      <button class="icona-btn" id="voce" aria-label=""></button>
      <span id="indicatore" class="indicatore">…</span>
    </header>

    <ul class="chat" id="chat" aria-live="polite"></ul>
    <div id="avviso"></div>

    <button class="occhio piccolo" id="mic" aria-label="Rispondi a voce"><span class="anello">${ICONE.microfono}</span></button>
    <div class="etichetta-mic" id="etichetta-mic"></div>

    <form class="risposta" id="form-risposta">
      <textarea id="campo" rows="2" placeholder="…oppure scrivi qui" aria-label="La tua risposta"
        autocapitalize="sentences" spellcheck="true"></textarea>
      <button class="pillola viola" type="submit" id="invia">Invia</button>
    </form>

    <div class="riquadro">
      <h2>Scheda in costruzione</h2>
      <div id="scheda"></div>
    </div>

    <div class="azioni">
      <button class="pillola grigia" data-azione="indietro">Riprendi dopo</button>
      <button class="pillola verde" id="pronta">Segna pronta</button>
    </div>
  `;

  const $ = (sel) => radice.querySelector(sel);
  const campo = $('#campo');
  campo.value = localStorage.getItem(chiaveBozza) ?? '';

  function disegna() {
    $('#titolo').textContent = dialogo.idea?.titolo ?? 'Nuova idea';
    const voci = [`<li class="app">${esc(BENVENUTO)}</li>`];
    for (const m of dialogo.messaggi) voci.push(`<li class="${m.ruolo}">${esc(m.testo)}</li>`);
    if (occupato) voci.push('<li class="app pensa">Sto pensando…</li>');
    $('#chat').innerHTML = voci.join('');

    const ripetibile = !occupato && attendeDomanda(dialogo);
    $('#avviso').innerHTML = avviso
      ? `<div class="avviso">${esc(avviso)}${ripetibile ? ' <button class="pillola grigia" id="riprova">Riprova</button>' : ''}</div>`
      : '';
    $('#riprova')?.addEventListener('click', chiediDomanda);

    $('#scheda').innerHTML = schedaHtml(dialogo.scheda);
    const pronta = $('#pronta');
    pronta.disabled = occupato || !dialogo.idea;
    pronta.classList.toggle('evidenzia', dialogo.completa);
    $('#invia').disabled = occupato;
    $('#mic').classList.toggle('ascolta', Boolean(ascolto));
    $('#etichetta-mic').textContent = ascolto ? 'Ti ascolto… tocca per inviare' : 'Tocca per parlare';
    $('#voce').innerHTML = leggiDomande ? ICONE.altoparlante : ICONE.muto;
    $('#voce').setAttribute('aria-label', leggiDomande ? 'Non leggere le domande ad alta voce' : 'Leggi le domande ad alta voce');
    $('#chat').lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  const idEsistenti = () => stato.dialoghi.filter((d) => d.chiave !== dialogo.chiave && d.idea).map((d) => d.idea.id);

  async function salva() {
    try {
      await salvaDialogo(dialogo);
    } catch (e) {
      // Il salvataggio locale non deve mai fallire in silenzio.
      avviso = `Attenzione: salvataggio sul telefono non riuscito (${e.message}). Non chiudere l'app.`;
    }
  }

  async function chiediDomanda() {
    if (occupato) return;
    occupato = true;
    avviso = '';
    disegna();
    let risposta = null;
    try {
      const claude = creaClaude({ apiKey: stato.config.anthropic_key });
      risposta = normalizzaRisposta(await claude.prossimaDomanda({
        modello: stato.config.modello_domande,
        scheda: dialogo.scheda,
        messaggi: dialogo.messaggi,
      }));
    } catch (e) {
      // TypeError da fetch = nessuna rete (galleria, ascensore), anche se il telefono si crede online.
      avviso = !navigator.onLine || e instanceof TypeError
        ? 'Niente rete: la tua risposta è salvata. Premi Riprova quando torna il segnale.'
        : `Claude non ha risposto (${e.message}). La tua risposta è salvata.`;
    }
    dialogo = assicuraIdea(dialogo, { titolo: risposta?.titolo, idEsistenti: idEsistenti() });
    if (risposta) dialogo = applicaRisposta(dialogo, risposta);
    occupato = false;
    await salva();
    disegna();
    if (risposta && leggiDomande) leggiAdAltaVoce(risposta.domanda);
  }

  async function invia(testo) {
    const t = String(testo ?? '').trim();
    if (!t || occupato) return;
    dialogo = aggiungiMessaggio(dialogo, 'utente', t);
    campo.value = '';
    localStorage.removeItem(chiaveBozza);
    await salva(); // prima il telefono, poi Claude
    disegna();
    await chiediDomanda();
  }

  function avviaAscolto() {
    if (!voceSupportata()) {
      avviso = 'Questo browser non supporta il microfono: scrivi la risposta qui sotto (su Android usa Chrome).';
      disegna();
      return;
    }
    globalThis.speechSynthesis?.cancel();
    let dettato = campo.value.trim() ? `${campo.value.trim()} ` : '';
    inviaAllaFine = false;
    try {
      ascolto = creaRiconoscimento({
        onParziale: (p) => { campo.value = dettato + p; },
        onFinale: (f) => {
          dettato += `${f} `;
          campo.value = dettato;
          localStorage.setItem(chiaveBozza, campo.value);
        },
        onErrore: (e) => {
          if (/no-speech|aborted/.test(e.message)) return;
          avviso = /not-allowed|service-not-allowed/.test(e.message)
            ? 'Il permesso del microfono è negato: abilitalo nelle impostazioni del browser per questo sito.'
            : `${e.message}. Puoi scrivere la risposta qui sotto.`;
        },
        onFine: () => {
          ascolto = null;
          disegna();
          if (inviaAllaFine) invia(campo.value);
        },
      });
      ascolto.avvia();
    } catch (e) {
      ascolto = null;
      avviso = e.message;
    }
    disegna();
  }

  $('#mic').onclick = () => {
    if (ascolto) {
      inviaAllaFine = true;
      ascolto.ferma();
    } else if (!occupato) {
      avviaAscolto();
    }
  };
  $('#voce').onclick = () => {
    leggiDomande = !leggiDomande;
    localStorage.setItem(`${PREFISSO}leggi-domande`, leggiDomande ? '1' : '0');
    if (!leggiDomande) globalThis.speechSynthesis?.cancel();
    disegna();
  };
  campo.oninput = () => localStorage.setItem(chiaveBozza, campo.value);
  $('#form-risposta').onsubmit = (e) => {
    e.preventDefault();
    if (ascolto) {
      inviaAllaFine = true;
      ascolto.ferma();
    } else {
      invia(campo.value);
    }
  };
  $('#pronta').onclick = async () => {
    if (!dialogo.idea || occupato) return;
    if (dialogo.idea.stato === STATI.IN_DISCUSSIONE) dialogo = { ...dialogo, idea: cambiaStato(dialogo.idea, STATI.PRONTA) };
    await salva();
    vai('home');
  };
  const esci = () => {
    ascolto?.ferma();
    globalThis.speechSynthesis?.cancel();
    vai('home');
  };
  radice.querySelectorAll('[data-azione="indietro"]').forEach((b) => { b.onclick = esci; });

  disegna();
  if (parametri.testoIniziale && !dialogo.messaggi.length) {
    await invia(parametri.testoIniziale);
  } else if (parametri.avviaMicrofono) {
    avviaAscolto(); // nello stesso tocco del pulsante in home: il browser lo permette
  } else if (attendeDomanda(dialogo)) {
    avviso = "L'ultima risposta non ha ancora avuto una domanda.";
    disegna();
  }
}
