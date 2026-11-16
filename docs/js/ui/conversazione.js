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
import { documentoDaIdea, simili } from '../ricerca.js';
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
  let similiDaMostrare = null; // possibile doppione: { id, titolo }
  const avvisati = new Set(); // ogni doppione si segnala una volta sola per conversazione
  let leggiDomande = leggiPreferenzaVoce();

  // Il microfono sta sempre fermo in alto; sotto scorrono i messaggi, il più recente
  // subito sotto il microfono. La pagina non scorre mai.
  radice.innerHTML = `
    <div class="schermo-chat">
      <header class="barra">
        <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
        <h1 id="titolo"></h1>
        <button class="icona-btn" id="voce" aria-label=""></button>
        <span id="indicatore" class="indicatore">…</span>
      </header>

      <div class="comandi-alto">
        <div class="riga-mic">
          <button class="occhio piccolo" id="mic" aria-label="Rispondi a voce"><span class="anello">${ICONE.microfono}</span></button>
          <div class="etichetta-mic" id="etichetta-mic"></div>
        </div>
        <form class="risposta" id="form-risposta">
          <textarea id="campo" rows="1" placeholder="…oppure scrivi qui" aria-label="La tua risposta"
            autocapitalize="sentences" spellcheck="true"></textarea>
          <button class="pillola viola" type="submit" id="invia">Invia</button>
        </form>
        <div id="avviso"></div>
      </div>

      <ul class="chat" id="chat" aria-live="polite"></ul>

      <div class="comandi-basso">
        <details class="scheda-ripiegabile">
          <summary id="sommario-scheda"></summary>
          <div id="scheda"></div>
        </details>
        <div class="azioni">
          <button class="pillola grigia" data-azione="indietro">Riprendi dopo</button>
          <button class="pillola verde" id="pronta">Segna pronta</button>
        </div>
      </div>
    </div>
  `;

  const $ = (sel) => radice.querySelector(sel);

  function disegna() {
    $('#titolo').textContent = dialogo.idea?.titolo ?? 'Nuova idea';
    const voci = [`<li class="app">${esc(BENVENUTO)}</li>`];
    for (const m of dialogo.messaggi) voci.push(`<li class="${m.ruolo}">${esc(m.testo)}</li>`);
    if (occupato) voci.push('<li class="app pensa">Sto pensando…</li>');
    $('#chat').innerHTML = voci.reverse().join(''); // il più recente in cima, sotto il microfono

    const ripetibile = !occupato && attendeDomanda(dialogo);
    if (mancantiDaConfermare) {
      $('#avviso').innerHTML = `<div class="avviso">
        Mancano ancora: ${esc(mancantiDaConfermare.join(', '))}. A casa la skill dovrà chiederteli. Segnarla pronta comunque?
        <button class="pillola grigia" id="continua">Continuo a rispondere</button>
        <button class="pillola verde" id="conferma-pronta">Pronta comunque</button>
      </div>`;
      $('#continua').onclick = () => { mancantiDaConfermare = null; disegna(); };
      $('#conferma-pronta').onclick = segnaPronta;
    } else if (similiDaMostrare) {
      $('#avviso').innerHTML = `<div class="avviso">
        Somiglia a «${esc(similiDaMostrare.titolo)}», che hai già. Potrebbe essere la stessa idea.
        <button class="pillola grigia" id="guarda-simile">Guardala</button>
        <button class="pillola viola" id="ignora-simile">Continua</button>
      </div>`;
      // La conversazione è già salvata: si può uscire e tornare senza perdere nulla.
      $('#guarda-simile').onclick = () => vai('idea', { id: similiDaMostrare.id });
      $('#ignora-simile').onclick = () => { similiDaMostrare = null; disegna(); };
    } else $('#avviso').innerHTML = avviso
      ? `<div class="avviso">${esc(avviso)}${ripetibile ? ' <button class="pillola grigia" id="riprova">Riprova</button>' : ''}</div>`
      : '';
    $('#riprova')?.addEventListener('click', chiediDomanda);

    $('#scheda').innerHTML = schedaHtml(dialogo.scheda);
    $('#sommario-scheda').textContent = `Scheda: ${4 - sezioniMancanti(dialogo.scheda).length} sezioni su 4`;
    const pronta = $('#pronta');
    pronta.disabled = occupato || !dialogo.idea;
    pronta.classList.toggle('evidenzia', dialogo.completa);
    $('#invia').disabled = occupato;
    $('#voce').innerHTML = leggiDomande ? ICONE.altoparlante : ICONE.muto;
    $('#voce').setAttribute('aria-label', leggiDomande ? 'Non leggere le domande ad alta voce' : 'Leggi le domande ad alta voce');
    $('#chat').scrollTop = 0; // si torna all'ultimo messaggio, la pagina resta ferma
  }

  const idEsistenti = () => stato.dialoghi.filter((d) => d.chiave !== dialogo.chiave && d.idea).map((d) => d.idea.id);

  // Confronto con le altre idee, sul telefono e senza costi: serve a non fare due volte la stessa idea.
  function cercaDoppioni() {
    if (!dialogo.idea) return;
    const mio = documentoDaIdea(dialogo.idea, dialogo);
    const altri = stato.dialoghi.filter((d) => d.idea && d.idea.id !== dialogo.idea.id);
    const doppione = simili(mio, altri.map((d) => documentoDaIdea(d.idea, d))).find((s) => s.doppione && !avvisati.has(s.id));
    if (!doppione) return;
    avvisati.add(doppione.id);
    similiDaMostrare = { id: doppione.id, titolo: altri.find((d) => d.idea.id === doppione.id).idea.titolo };
  }

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
    cercaDoppioni();
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
