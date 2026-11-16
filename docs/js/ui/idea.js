// Pagina di approfondimento di un'idea: scheda, storico delle versioni, migliorie, azioni.

import { STATI, cambiaStato, archivia, cestina, ripristina } from '../idee.js';
import { esc, ICONE } from './dom.js';
import { STILE_STATO, badge } from './stile-stati.js';
import { schedaHtml } from './scheda.js';
import { documentoDaIdea, simili } from '../ricerca.js';

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
  // Idee simili: confronto fatto sul telefono, senza Claude e senza costi.
  const trovate = dialogo
    ? simili(
      documentoDaIdea(idea, dialogo),
      stato.dialoghi.filter((d) => d.idea && d.idea.id !== idea.id).map((d) => documentoDaIdea(d.idea, d)),
    )
    : [];
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

    ${trovate.length ? `
      <div class="riquadro simili">
        <h2>Idee simili tra le tue</h2>
        <ul class="lista">${trovate.map((t) => {
          const altra = stato.idee.find((i) => i.id === t.id);
          const s = STILE_STATO[altra.stato];
          return `<li><button class="scheda-idea" data-simile="${esc(altra.id)}">
            <span class="quadro" style="background:${s.colore}">${s.icona}</span>
            <span><span class="titolo-idea">${esc(altra.titolo)}</span><br>
              <span class="riga-stato">${badge(altra.stato)}${t.doppione ? '<span class="etichetta-doppione">Possibile doppione</span>' : ''}</span></span>
          </button></li>`;
        }).join('')}</ul>
      </div>` : ''}

    ${dialogo && [STATI.IN_DISCUSSIONE, STATI.PRONTA].includes(idea.stato) ? `
      <div class="azioni"><button class="pillola viola" id="riapri">Continua la conversazione</button></div>` : ''}

    ${dialogo ? `<div class="azioni"><button class="pillola rossa" id="ispirazione">${ICONE.play} Ispirazione da YouTube${
      Object.keys(dialogo.ispirazione?.risultati ?? {}).length ? ' · salvata' : ''}</button></div>` : ''}

    <div class="riquadro">
      <h2>Storico</h2>
      ${storico.map((s) => `<p>v${s.v} · ${esc(s.testo)} · <span class="nota">${data(s.quando)}${s.nota ? ` · ${s.nota}` : ''}</span></p>`).join('')}
    </div>

    ${migliorabile ? `
      <button class="occhio piccolo" id="migliora" aria-label="Migliora questa idea" style="margin-top:20px"><span class="anello">${ICONE.microfono}</span></button>
      <div class="etichetta-occhio" style="font-size:16px">${bozzaAperta ? 'Riprendi la miglioria' : 'Migliora questa idea'}</div>` : ''}

    <div class="azioni">
      <button class="pillola viola" id="condividi" ${dialogo ? '' : 'disabled'}>${ICONE.messaggio} Condividi</button>
      ${idea.stato === STATI.ARCHIVIATA || idea.stato === STATI.NEL_CESTINO
        ? `<button class="pillola verde" data-sposta="ripristina">Ripristina</button>` : ''}
      ${idea.stato !== STATI.ARCHIVIATA ? `<button class="pillola grigia" data-sposta="archivia">${ICONE.scatola} Archivia</button>` : ''}
      ${idea.stato !== STATI.NEL_CESTINO ? `<button class="pillola grigia" data-sposta="cestina">${ICONE.cestino} Sposta nel cestino</button>` : ''}
    </div>
    <p class="nota" style="text-align:center">
      ${dialogo ? 'Archivio e cestino cambiano solo lo stato: non si perde niente e il progetto sul PC non viene toccato.'
        : 'Le idee d\'esempio non si possono spostare né condividere.'}
    </p>
  `;
  radice.querySelector('[data-azione="indietro"]').onclick = () => vai('home');
  radice.querySelectorAll('[data-simile]').forEach((b) => {
    b.onclick = () => vai('idea', { id: b.dataset.simile });
  });
  radice.querySelector('#ispirazione')?.addEventListener('click', () => vai('ispirazione', { id: idea.id }));
  radice.querySelector('#condividi').onclick = () => {
    if (dialogo) vai('condivisione', { id: idea.id });
  };
  radice.querySelector('#riapri')?.addEventListener('click', async () => {
    if (dialogo.idea.stato === STATI.PRONTA) {
      await salvaDialogo({ ...dialogo, idea: cambiaStato(dialogo.idea, STATI.IN_DISCUSSIONE) });
    }
    vai('conversazione', { chiave: dialogo.chiave });
  });

  // Regola 4: archivio, cestino e ripristino cambiano solo stato.json. Nessuna conferma:
  // si torna sempre indietro (Annulla subito, oppure Ripristina quando si vuole).
  const MOSSE = {
    archivia: { fn: archivia, azione: 'Archiviata', testo: 'archiviata' },
    cestina: { fn: cestina, azione: 'Nel cestino', testo: 'spostata nel cestino' },
    ripristina: { fn: ripristina, azione: 'Ripristinata', testo: 'ripristinata' },
  };
  radice.querySelectorAll('[data-sposta]').forEach((b) => {
    if (!dialogo) {
      b.disabled = true;
      return;
    }
    b.onclick = async () => {
      const mossa = MOSSE[b.dataset.sposta];
      const prima = dialogo;
      await salvaDialogo({ ...dialogo, idea: mossa.fn(dialogo.idea) }, { soloStato: true, azione: mossa.azione });
      stato.avviso = {
        testo: `«${idea.titolo}» ${mossa.testo}.`,
        annulla: async () => {
          await salvaDialogo({ ...prima, idea: { ...prima.idea, aggiornata: new Date().toISOString() } },
            { soloStato: true, azione: 'Annullato' });
        },
      };
      vai('home');
    };
  });
  radice.querySelector('#migliora')?.addEventListener('click', () => {
    // Nello stesso tocco: il browser permette di accendere subito il microfono.
    vai('miglioria', { id: idea.id, avviaMicrofono: !bozzaAperta });
  });
}
