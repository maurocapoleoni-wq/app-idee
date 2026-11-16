// Schermata conversazione: l'utente racconta l'idea a voce o per iscritto,
// Haiku fa una domanda alla volta e la scheda si costruisce mentre si parla.
// Regola 2: ogni risposta dell'utente viene salvata in locale PRIMA di chiamare Claude.

import {
  nuovoDialogo, aggiungiMessaggio, attendeDomanda, normalizzaRisposta, assicuraIdea, applicaRisposta,
  sezioniMancanti,
} from '../dialogo.js';
import { cambiaStato, STATI } from '../idee.js';
import { creaClaude } from '../claude.js';
import { leggiAdAltaVoce } from '../voce.js';
import { esc, ICONE } from './dom.js';
import { schedaHtml } from './scheda.js';
import { collegaDettatura } from './dettatura.js';

const PREFISSO = 'raccoglitore-idee:';
const BENVENUTO = 'Raccontami la tua idea: che app ti piacerebbe avere, e per fare cosa?';

const leggiPreferenzaVoce = () => localStorage.getItem(`${PREFISSO}leggi-domande`) !== '0';

export async function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  let dialogo = (parametri.chiave && stato.dialoghi.find((d) => d.chiave === parametri.chiave))
    || nuovoDialogo(crypto.randomUUID());
  let occupato = false;
  let avviso = '';
  let mancantiDaConfermare = null;
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

  function disegna() {
    $('#titolo').textContent = dialogo.idea?.titolo ?? 'Nuova idea';
    const voci = [`<li class="app">${esc(BENVENUTO)}</li>`];
    for (const m of dialogo.messaggi) voci.push(`<li class="${m.ruolo}">${esc(m.testo)}</li>`);
    if (occupato) voci.push('<li class="app pensa">Sto pensando…</li>');
    $('#chat').innerHTML = voci.join('');

    const ripetibile = !occupato && attendeDomanda(dialogo);
    if (mancantiDaConfermare) {
      $('#avviso').innerHTML = `<div class="avviso">
        Mancano ancora: ${esc(mancantiDaConfermare.join(', '))}. A casa la skill dovrà chiederteli. Segnarla pronta comunque?
        <button class="pillola grigia" id="continua">Continuo a rispondere</button>
        <button class="pillola verde" id="conferma-pronta">Pronta comunque</button>
      </div>`;
      $('#continua').onclick = () => { mancantiDaConfermare = null; disegna(); };
      $('#conferma-pronta').onclick = segnaPronta;
    } else $('#avviso').innerHTML = avviso
      ? `<div class="avviso">${esc(avviso)}${ripetibile ? ' <button class="pillola grigia" id="riprova">Riprova</button>' : ''}</div>`
      : '';
    $('#riprova')?.addEventListener('click', chiediDomanda);

    $('#scheda').innerHTML = schedaHtml(dialogo.scheda);
    const pronta = $('#pronta');
    pronta.disabled = occupato || !dialogo.idea;
    pronta.classList.toggle('evidenzia', dialogo.completa);
    $('#invia').disabled = occupato;
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
    mancantiDaConfermare = null;
    dialogo = aggiungiMessaggio(dialogo, 'utente', t);
    await salva(); // prima il telefono, poi Claude
    disegna();
    await chiediDomanda();
  }

  const dettatura = collegaDettatura({
    mic: $('#mic'),
    etichetta: $('#etichetta-mic'),
    campo: $('#campo'),
    form: $('#form-risposta'),
    chiaveBozza: `${PREFISSO}bozza:${dialogo.chiave}`,
    libero: () => !occupato,
    onInvia: invia,
    onAvviso: (testo) => { avviso = testo; disegna(); },
    onCambio: disegna,
  });

  $('#voce').onclick = () => {
    leggiDomande = !leggiDomande;
    localStorage.setItem(`${PREFISSO}leggi-domande`, leggiDomande ? '1' : '0');
    if (!leggiDomande) globalThis.speechSynthesis?.cancel();
    disegna();
  };
  async function segnaPronta() {
    if (!dialogo.idea || occupato) return;
    if (dialogo.idea.stato === STATI.IN_DISCUSSIONE) dialogo = { ...dialogo, idea: cambiaStato(dialogo.idea, STATI.PRONTA) };
    await salva();
    vai('home');
  }
  $('#pronta').onclick = () => {
    if (!dialogo.idea || occupato) return;
    const mancanti = sezioniMancanti(dialogo.scheda);
    if (!mancanti.length) {
      segnaPronta();
      return;
    }
    mancantiDaConfermare = mancanti;
    disegna();
    $('#avviso').scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const esci = () => {
    dettatura.ferma();
    globalThis.speechSynthesis?.cancel();
    vai('home');
  };
  radice.querySelectorAll('[data-azione="indietro"]').forEach((b) => { b.onclick = esci; });

  disegna();
  if (parametri.testoIniziale && !dialogo.messaggi.length) {
    await invia(parametri.testoIniziale);
  } else if (parametri.avviaMicrofono) {
    dettatura.avvia(); // nello stesso tocco del pulsante in home: il browser lo permette
  } else if (attendeDomanda(dialogo)) {
    avviso = "L'ultima risposta non ha ancora avuto una domanda.";
    disegna();
  }
}
