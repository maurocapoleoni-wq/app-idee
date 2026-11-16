// Schermata conversazione. Nel setup mostra solo la struttura:
// la conversazione con Haiku è il passo 1 dell'ordine di sviluppo.

import { esc, ICONE } from './dom.js';

export function mostra(radice, { vai, parametri }) {
  radice.innerHTML = `
    <header class="barra">
      <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
      <h1>Nuova idea</h1>
      <span id="indicatore" class="indicatore">…</span>
    </header>

    ${parametri.testoIniziale ? `<div class="riquadro"><h2>Hai scritto</h2><p>${esc(parametri.testoIniziale)}</p></div>` : ''}

    <div class="riquadro">
      <h2>Scheda in costruzione</h2>
      <p>Utenti: <em>da definire</em></p>
      <p>Funzioni: <em>da definire</em></p>
      <p>Piattaforma: <em>da definire</em></p>
    </div>

    <p class="nota" style="text-align:center;margin-top:16px">
      Le domande interattive con Claude arrivano nel prossimo passo di sviluppo.
    </p>

    <button class="occhio piccolo" aria-label="Rispondi a voce"><span class="anello">${ICONE.microfono}</span></button>

    <div class="azioni">
      <button class="pillola grigia" data-azione="indietro">Riprendi dopo</button>
      <button class="pillola verde" disabled>Segna pronta</button>
    </div>
  `;
  radice.querySelectorAll('[data-azione="indietro"]').forEach((b) => {
    b.onclick = () => vai('home');
  });
}
