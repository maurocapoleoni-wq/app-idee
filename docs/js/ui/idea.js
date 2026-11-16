// Pagina di approfondimento di un'idea: scheda, storico, miglioria, azioni.
// Nel setup è navigabile ma le azioni arrivano nei passi successivi.

import { STATI, cambiaStato } from '../idee.js';
import { esc, ICONE } from './dom.js';
import { badge } from './stile-stati.js';
import { schedaHtml } from './scheda.js';

function data(isoString) {
  return new Date(isoString).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  const idea = stato.idee.find((i) => i.id === parametri.id);
  const dialogo = stato.dialoghi.find((d) => d.idea?.id === parametri.id);
  if (!idea) {
    vai('home');
    return;
  }
  const migliorabile = [STATI.IMPOSTATA, STATI.MIGLIORIA_IN_ATTESA, STATI.ARCHIVIATA].includes(idea.stato);
  const storico = [
    ...[...idea.migliorie].reverse().map((m) => ({ v: m.versione, testo: m.titolo, quando: m.creata })),
    { v: 1, testo: 'Prima versione', quando: idea.creata },
  ];

  radice.innerHTML = `
    <header class="barra">
      <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
      <h1>${esc(idea.titolo)}</h1>
    </header>
    ${badge(idea.stato)}

    <div class="riquadro">
      <h2>Scheda attuale · versione ${idea.versione}</h2>
      ${dialogo ? schedaHtml(dialogo.scheda) : '<p class="nota">Idea d\'esempio: non ha una scheda.</p>'}
    </div>

    ${dialogo && idea.stato === STATI.PRONTA ? `
      <div class="azioni"><button class="pillola grigia" id="riapri">Continua la conversazione</button></div>
      <p class="nota" style="text-align:center">È pronta: a casa la skill imposta-idee la trasforma in un progetto.</p>` : ''}

    <div class="riquadro">
      <h2>Storico</h2>
      ${storico.map((s) => `<p>v${s.v} · ${esc(s.testo)} · <span class="nota">${data(s.quando)}</span></p>`).join('')}
    </div>

    ${migliorabile ? `
      <button class="occhio piccolo" aria-label="Migliora questa idea" style="margin-top:20px"><span class="anello">${ICONE.microfono}</span></button>
      <div class="etichetta-occhio" style="font-size:16px">Migliora questa idea</div>` : ''}

    <div class="azioni">
      <button class="pillola grigia" disabled>Condividi</button>
      <button class="pillola grigia" disabled>Archivia</button>
      <button class="pillola grigia" disabled>Sposta nel cestino</button>
    </div>
    <p class="nota" style="text-align:center">Condividi, archivio e cestino arrivano nei prossimi passi di sviluppo.</p>
  `;
  radice.querySelector('[data-azione="indietro"]').onclick = () => vai('home');
  radice.querySelector('#riapri')?.addEventListener('click', async () => {
    await salvaDialogo({ ...dialogo, idea: cambiaStato(dialogo.idea, STATI.IN_DISCUSSIONE) });
    vai('conversazione', { chiave: dialogo.chiave });
  });
}
