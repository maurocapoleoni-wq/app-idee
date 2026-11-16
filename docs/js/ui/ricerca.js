// Schermata Cerca: tra tutte le idee, anche in archivio e nel cestino, scrivendo o a voce.
// Funziona sul telefono, senza rete e senza costi: non chiama Claude.

import { cerca, documentoDaIdea } from '../ricerca.js';
import { esc, ICONE } from './dom.js';
import { STILE_STATO, badge } from './stile-stati.js';
import { collegaDettatura } from './dettatura.js';

const PREFISSO = 'raccoglitore-idee:';

export function mostra(radice, { stato, vai }) {
  const idee = new Map(stato.idee.map((i) => [i.id, i]));
  const documenti = stato.idee.map((idea) => documentoDaIdea(idea, stato.dialoghi.find((d) => d.idea?.id === idea.id)));
  let avviso = '';

  radice.innerHTML = `
    <div class="schermo-chat">
      <header class="barra">
        <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
        <h1>Cerca tra le idee</h1>
        <span id="indicatore" class="indicatore">…</span>
      </header>

      <div class="comandi-alto">
        <div class="riga-mic">
          <button class="occhio piccolo" id="mic" aria-label="Cerca a voce"><span class="anello">${ICONE.microfono}</span></button>
          <div class="etichetta-mic" id="etichetta-mic"></div>
        </div>
        <form class="risposta" id="form-cerca">
          <textarea id="campo" rows="1" placeholder="Cerca una parola…" aria-label="Cosa cerchi"
            autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
          <button class="pillola viola" type="submit">Cerca</button>
        </form>
        <div id="avviso"></div>
      </div>

      <div class="area-lista" id="risultati"></div>
    </div>
  `;
  const $ = (sel) => radice.querySelector(sel);
  const campo = $('#campo');

  function disegna() {
    $('#avviso').innerHTML = avviso ? `<div class="avviso">${esc(avviso)}</div>` : '';
    const query = campo.value.trim();
    if (!query) {
      $('#risultati').innerHTML = `<p class="vuota">Scrivi o detta una parola: cerco nel titolo, nella scheda e in ciò che hai detto,
        anche tra le idee in archivio e nel cestino.</p>`;
      return;
    }
    const trovate = cerca(documenti, query);
    if (!trovate.length) {
      $('#risultati').innerHTML = `<p class="vuota">Nessuna idea contiene «${esc(query)}». Prova con una parola più corta.</p>`;
      return;
    }
    $('#risultati').innerHTML = `
      <p class="nota">${trovate.length === 1 ? '1 idea trovata' : `${trovate.length} idee trovate`}</p>
      <ul class="lista">${trovate.map((r) => {
        const idea = idee.get(r.id);
        const s = STILE_STATO[idea.stato];
        return `<li><button class="scheda-idea" data-id="${esc(idea.id)}">
          <span class="quadro" style="background:${s.colore}">${s.icona}</span>
          <span>
            <span class="titolo-idea">${esc(idea.titolo)}</span><br>
            <span class="riga-stato">${badge(idea.stato)}</span>
            ${r.estratto ? `<span class="estratto"><strong>${esc(r.campo)}:</strong> ${esc(r.estratto)}</span>` : ''}
          </span>
        </button></li>`;
      }).join('')}</ul>`;
    radice.querySelectorAll('[data-id]').forEach((b) => {
      b.onclick = () => vai('idea', { id: b.dataset.id });
    });
  }

  // Cerca mentre scrivi. A voce: appena finisci di parlare e tocchi il microfono, il testo resta nel campo.
  const chiaveBozza = `${PREFISSO}bozza-ricerca`;
  localStorage.removeItem(chiaveBozza);
  const dettatura = collegaDettatura({
    mic: $('#mic'),
    etichetta: $('#etichetta-mic'),
    campo,
    form: $('#form-cerca'),
    chiaveBozza,
    libero: () => true,
    onInvia: (testo) => {
      campo.value = testo; // l'invio svuota il campo: qui si rimette, perché in ricerca il testo deve restare
      disegna();
    },
    onAvviso: (testo) => { avviso = testo; disegna(); },
    onCambio: disegna,
  });
  campo.addEventListener('input', () => {
    avviso = '';
    disegna();
  });

  radice.querySelector('[data-azione="indietro"]').onclick = () => {
    dettatura.ferma();
    vai('home');
  };

  disegna();
  campo.focus({ preventScroll: true });
}
