// Schermata miglioria: una breve conversazione con Haiku su cosa cambiare in un'idea già impostata.
// La bozza resta sul telefono; con "Salva miglioria" nasce la versione nuova nella cassetta.

import {
  iniziaMiglioria, aggiungiMessaggioMiglioria, attendeDomandaMiglioria, normalizzaRispostaMiglioria,
  applicaRispostaMiglioria, salvaMiglioria,
} from '../dialogo.js';
import { schedaMd } from '../cassetta.js';
import { creaClaude } from '../claude.js';
import { leggiAdAltaVoce } from '../voce.js';
import { esc, ICONE } from './dom.js';
import { collegaDettatura } from './dettatura.js';

const PREFISSO = 'raccoglitore-idee:';
const BENVENUTO = 'Cosa vuoi migliorare in questa idea?';

export function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  const trovato = stato.dialoghi.find((d) => d.idea?.id === parametri.id);
  if (!trovato) {
    vai('home');
    return;
  }
  let dialogo = iniziaMiglioria(trovato);
  let occupato = false;
  let avviso = '';
  const leggiDomande = localStorage.getItem(`${PREFISSO}leggi-domande`) !== '0';

  radice.innerHTML = `
    <div class="schermo-chat">
      <header class="barra">
        <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
        <h1>Migliora: ${esc(dialogo.idea.titolo)}</h1>
        <span id="indicatore" class="indicatore">…</span>
      </header>
      <p class="nota">Diventerà la versione ${dialogo.idea.versione + 1}.</p>

      <div class="comandi-alto">
        <div class="riga-mic">
          <button class="occhio piccolo" id="mic" aria-label="Racconta la miglioria a voce"><span class="anello">${ICONE.microfono}</span></button>
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
          <summary id="sommario-riepilogo"></summary>
          <div id="riepilogo"></div>
        </details>
        <div class="azioni">
          <button class="pillola grigia" data-azione="indietro">Riprendi dopo</button>
          <button class="pillola verde" id="salva">Salva miglioria</button>
        </div>
      </div>
    </div>
  `;
  const $ = (sel) => radice.querySelector(sel);

  function disegna() {
    const b = dialogo.bozzaMiglioria;
    const voci = [`<li class="app">${esc(BENVENUTO)}</li>`];
    for (const m of b.messaggi) voci.push(`<li class="${m.ruolo}">${esc(m.testo)}</li>`);
    if (occupato) voci.push('<li class="app pensa">Sto pensando…</li>');
    $('#chat').innerHTML = voci.reverse().join(''); // il più recente in cima, sotto il microfono
    const ripetibile = !occupato && attendeDomandaMiglioria(dialogo);
    $('#avviso').innerHTML = avviso
      ? `<div class="avviso">${esc(avviso)}${ripetibile ? ' <button class="pillola grigia" id="riprova">Riprova</button>' : ''}</div>`
      : '';
    $('#riprova')?.addEventListener('click', chiediDomanda);
    $('#sommario-riepilogo').textContent = b.titolo ? `Miglioria: ${b.titolo}` : 'Miglioria in costruzione';
    $('#riepilogo').innerHTML = `
      <p><strong>Titolo:</strong> ${b.titolo ? esc(b.titolo) : '<em>da definire</em>'}</p>
      <p><strong>Cosa cambia:</strong> ${b.descrizione ? esc(b.descrizione) : '<em>da definire</em>'}</p>`;
    const haTesto = b.messaggi.some((m) => m.ruolo === 'utente');
    $('#salva').disabled = occupato || !haTesto;
    $('#salva').classList.toggle('evidenzia', b.completa);
    $('#invia').disabled = occupato;
    $('#chat').scrollTop = 0; // si torna all'ultimo messaggio, la pagina resta ferma
  }

  async function salvaBozza() {
    try {
      await salvaDialogo(dialogo, { cassetta: false }); // la bozza resta sul telefono
    } catch (e) {
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
      risposta = normalizzaRispostaMiglioria(await claude.prossimaDomandaMiglioria({
        modello: stato.config.modello_domande,
        schedaMarkdown: schedaMd(dialogo.idea, dialogo.scheda),
        migliorieFatte: dialogo.idea.migliorie,
        messaggi: dialogo.bozzaMiglioria.messaggi,
      }));
    } catch (e) {
      avviso = !navigator.onLine || e instanceof TypeError
        ? 'Niente rete: la tua risposta è salvata. Puoi premere Riprova più tardi o salvare la miglioria così.'
        : `Claude non ha risposto (${e.message}). La tua risposta è salvata.`;
    }
    if (risposta) dialogo = applicaRispostaMiglioria(dialogo, risposta);
    occupato = false;
    await salvaBozza();
    disegna();
    if (risposta && leggiDomande) leggiAdAltaVoce(risposta.domanda);
  }

  async function invia(testo) {
    if (occupato) return;
    dialogo = aggiungiMessaggioMiglioria(dialogo, 'utente', testo);
    await salvaBozza();
    disegna();
    await chiediDomanda();
  }

  const dettatura = collegaDettatura({
    mic: $('#mic'),
    etichetta: $('#etichetta-mic'),
    campo: $('#campo'),
    form: $('#form-risposta'),
    chiaveBozza: `${PREFISSO}bozza-miglioria:${dialogo.chiave}`,
    libero: () => !occupato,
    onInvia: invia,
    onAvviso: (testo) => { avviso = testo; disegna(); },
    onCambio: disegna,
  });

  $('#salva').onclick = async () => {
    if (occupato) return;
    try {
      dialogo = salvaMiglioria(dialogo);
    } catch (e) {
      avviso = e.message;
      disegna();
      return;
    }
    dettatura.ferma();
    await salvaDialogo(dialogo); // ora va nella cassetta: file della miglioria + stato
    vai('idea', { id: dialogo.idea.id });
  };
  const esci = () => {
    dettatura.ferma();
    globalThis.speechSynthesis?.cancel();
    vai('idea', { id: dialogo.idea.id });
  };
  radice.querySelectorAll('[data-azione="indietro"]').forEach((b) => { b.onclick = esci; });

  disegna();
  if (parametri.avviaMicrofono) dettatura.avvia();
}
