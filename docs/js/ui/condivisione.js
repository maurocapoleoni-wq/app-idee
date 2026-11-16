// Schermata Condividi: Haiku trasforma la scheda in un messaggio per un amico o un cliente.
// L'anteprima si corregge a mano o chiedendo una modifica (anche a voce), poi parte
// con il menu di condivisione del telefono. Regola 8: si usa SOLO la parte pubblica della scheda.

import { schedaPerCondividere } from '../cassetta.js';
import { creaClaude } from '../claude.js';
import { condividi } from '../condividi.js';
import { esc, ICONE } from './dom.js';
import { collegaDettatura } from './dettatura.js';

const PREFISSO = 'raccoglitore-idee:';
const DESTINATARI = { amico: 'Per un amico', cliente: 'Per un cliente' };

export function mostra(radice, { stato, vai, parametri }) {
  const dialogo = stato.dialoghi.find((d) => d.idea?.id === parametri.id);
  if (!dialogo) {
    vai('home');
    return;
  }
  const { idea } = dialogo;
  const chiaveBozza = `${PREFISSO}condividi:${idea.id}`;
  const salvata = JSON.parse(localStorage.getItem(chiaveBozza) ?? 'null');
  let destinatario = salvata?.destinatario ?? null;
  let occupato = false;
  let avviso = '';

  radice.innerHTML = `
    <div class="schermo-chat">
      <header class="barra">
        <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
        <h1>Condividi: ${esc(idea.titolo)}</h1>
      </header>
      <p class="nota">Il messaggio usa solo problema, utenti, funzioni e piattaforma: mai note o conversazioni.</p>

      <nav class="schede" role="tablist">
        ${Object.entries(DESTINATARI).map(([k, v]) => `<button role="tab" data-destinatario="${k}">${v}</button>`).join('')}
      </nav>

      <div class="area-messaggio">
        <textarea id="messaggio" aria-label="Messaggio da condividere"
          placeholder="Scegli per chi è il messaggio: Haiku lo scrive partendo dalla scheda."></textarea>
        <div id="avviso"></div>
      </div>

      <div class="comandi-basso">
        <form class="risposta" id="form-modifica">
          <button type="button" class="icona-btn mic-piccolo" id="mic" aria-label="Chiedi una modifica a voce">${ICONE.microfono}</button>
          <textarea id="richiesta" rows="1" placeholder="Es. «più corto»"
            aria-label="Modifica da chiedere" autocapitalize="sentences"></textarea>
          <button class="pillola grigia" type="submit" id="modifica">Modifica</button>
        </form>
        <span class="etichetta-mic" id="etichetta-mic" hidden></span>
        <div class="azioni">
          <button class="pillola grigia" data-azione="indietro">Chiudi</button>
          <button class="pillola viola" id="condividi">${ICONE.messaggio} Condividi</button>
        </div>
      </div>
    </div>
  `;
  const $ = (sel) => radice.querySelector(sel);
  const messaggio = $('#messaggio');
  messaggio.value = salvata?.testo ?? '';

  const salvaBozza = () => localStorage.setItem(chiaveBozza, JSON.stringify({ destinatario, testo: messaggio.value }));

  function disegna() {
    radice.querySelectorAll('[data-destinatario]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.destinatario === destinatario));
      b.disabled = occupato;
    });
    $('#avviso').innerHTML = avviso ? `<div class="avviso">${esc(avviso)}</div>` : '';
    messaggio.disabled = occupato;
    if (occupato) messaggio.placeholder = 'Sto scrivendo il messaggio…';
    $('#modifica').disabled = occupato || !destinatario || !messaggio.value.trim();
    $('#condividi').disabled = occupato || !messaggio.value.trim();
  }

  async function componi(richiesta = '') {
    if (occupato || !destinatario) return;
    occupato = true;
    avviso = '';
    disegna();
    try {
      const claude = creaClaude({ apiKey: stato.config.anthropic_key });
      messaggio.value = await claude.componiMessaggio({
        modello: stato.config.modello_domande,
        schedaMarkdown: schedaPerCondividere(idea, dialogo.scheda),
        destinatario,
        richiesta,
        messaggioAttuale: richiesta ? messaggio.value : '',
      });
      salvaBozza();
    } catch (e) {
      avviso = !navigator.onLine || e instanceof TypeError
        ? 'Niente rete: puoi scrivere il messaggio a mano e condividerlo lo stesso.'
        : `Claude non ha risposto (${e.message}). Puoi scrivere il messaggio a mano.`;
    }
    occupato = false;
    disegna();
  }

  radice.querySelectorAll('[data-destinatario]').forEach((b) => {
    b.onclick = () => {
      destinatario = b.dataset.destinatario;
      componi();
    };
  });
  messaggio.oninput = () => {
    salvaBozza();
    disegna();
  };

  const dettatura = collegaDettatura({
    mic: $('#mic'),
    etichetta: $('#etichetta-mic'),
    campo: $('#richiesta'),
    form: $('#form-modifica'),
    chiaveBozza: `${PREFISSO}bozza-modifica:${idea.id}`,
    libero: () => !occupato && Boolean(destinatario) && Boolean(messaggio.value.trim()),
    onInvia: (testo) => componi(testo),
    onAvviso: (testo) => { avviso = testo; disegna(); },
    onCambio: disegna,
  });

  $('#condividi').onclick = async () => {
    const testo = messaggio.value.trim();
    if (!testo) return;
    try {
      const esito = await condividi({ titolo: idea.titolo, testo });
      avviso = esito === 'copiato' ? 'Messaggio copiato: incollalo dove vuoi.' : '';
    } catch (e) {
      avviso = `Non riesco a condividere (${e.message}). Seleziona il testo e copialo a mano.`;
    }
    disegna();
  };
  const esci = () => {
    dettatura.ferma();
    vai('idea', { id: idea.id });
  };
  radice.querySelectorAll('[data-azione="indietro"]').forEach((b) => { b.onclick = esci; });

  disegna();
}
