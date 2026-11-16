// Pagina di approfondimento di un'idea: scheda, storico delle versioni, migliorie, azioni.

import { STATI, cambiaStato } from '../idee.js';
import { esc, ICONE } from './dom.js';
import { badge } from './stile-stati.js';
import { schedaHtml } from './scheda.js';

function data(isoString) {
  return new Date(isoString).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const SPIEGAZIONE = {
  [STATI.PRONTA]: 'È pronta: a casa la skill imposta-idee la trasforma in un progetto.',
  [STATI.IMPOSTATA]: 'È un progetto sul PC di casa. Puoi migliorarla da qui: la miglioria aspetterà il PC.',
  [STATI.MIGLIORIA_IN_ATTESA]: 'Ci sono migliorie in attesa: a casa la skill te le proporrà sul progetto.',
};

export function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  const idea = stato.idee.find((i) => i.id === parametri.id);
  const dialogo = stato.dialoghi.find((d) => d.idea?.id === parametri.id);
  if (!idea) {
    vai('home');
    return;
  }
  // Le idee d'esempio non hanno un dialogo: si guardano ma non si migliorano.
  const migliorabile = dialogo && [STATI.IMPOSTATA, STATI.MIGLIORIA_IN_ATTESA, STATI.ARCHIVIATA].includes(idea.stato);
  const bozzaAperta = dialogo?.bozzaMiglioria?.messaggi.length > 0;
  const storico = [
    ...[...idea.migliorie].reverse().map((m) => ({
      v: m.versione,
      testo: m.titolo,
      quando: m.creata,
      nota: m.applicata ? `applicata ${data(m.applicata)}` : 'in attesa del PC',
    })),
    { v: 1, testo: 'Prima versione', quando: idea.creata, nota: '' },
  ];

  radice.innerHTML = `
    <header class="barra">
      <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
      <h1>${esc(idea.titolo)}</h1>
      <span id="indicatore" class="indicatore">…</span>
    </header>
    ${badge(idea.stato)}
    ${SPIEGAZIONE[idea.stato] && dialogo ? `<p class="nota">${SPIEGAZIONE[idea.stato]}</p>` : ''}

    <div class="riquadro">
      <h2>Scheda · versione 1</h2>
      ${dialogo ? schedaHtml(dialogo.scheda) : '<p class="nota">Idea d\'esempio: non ha una scheda.</p>'}
    </div>

    ${dialogo && idea.stato === STATI.PRONTA ? `
      <div class="azioni"><button class="pillola grigia" id="riapri">Continua la conversazione</button></div>` : ''}

    <div class="riquadro">
      <h2>Storico</h2>
      ${storico.map((s) => `<p>v${s.v} · ${esc(s.testo)} · <span class="nota">${data(s.quando)}${s.nota ? ` · ${s.nota}` : ''}</span></p>`).join('')}
    </div>

    ${migliorabile ? `
      <button class="occhio piccolo" id="migliora" aria-label="Migliora questa idea" style="margin-top:20px"><span class="anello">${ICONE.microfono}</span></button>
      <div class="etichetta-occhio" style="font-size:16px">${bozzaAperta ? 'Riprendi la miglioria' : 'Migliora questa idea'}</div>` : ''}

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
  radice.querySelector('#migliora')?.addEventListener('click', () => {
    // Nello stesso tocco: il browser permette di accendere subito il microfono.
    vai('miglioria', { id: idea.id, avviaMicrofono: !bozzaAperta });
  });
}
