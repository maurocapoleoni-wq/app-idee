// Schermata principale: microfono, campo di testo, schede e lista 4 per pagina.

import { SCHEDE, inScheda, ordinaPerRecenti, pagina } from '../idee.js';
import { esc, ICONE } from './dom.js';
import { STILE_STATO, badge } from './stile-stati.js';

const NOMI_SCHEDE = { [SCHEDE.ATTIVE]: 'Attive', [SCHEDE.ARCHIVIO]: 'Archivio', [SCHEDE.CESTINO]: 'Cestino' };
const VUOTE = {
  [SCHEDE.ATTIVE]: 'Premi il microfono e racconta la tua prima idea.',
  [SCHEDE.ARCHIVIO]: 'Qui finiscono le app realizzate.',
  [SCHEDE.CESTINO]: 'Le idee scartate restano qui per sempre.',
};

function quando(isoString) {
  const d = new Date(isoString);
  const oggi = new Date();
  const ieri = new Date();
  ieri.setDate(oggi.getDate() - 1);
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === oggi.toDateString()) return `Oggi ${ora}`;
  if (d.toDateString() === ieri.toDateString()) return `Ieri ${ora}`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function schedaIdea(idea) {
  const s = STILE_STATO[idea.stato];
  return `<li><button class="scheda-idea" data-id="${esc(idea.id)}">
    <span class="quadro" style="background:${s.colore}">${s.icona}</span>
    <span>
      <span class="titolo-idea">${esc(idea.titolo)}</span><br>
      <span class="data-idea">${quando(idea.aggiornata)}</span><br>
      ${badge(idea.stato)}
    </span>
  </button></li>`;
}

export function mostra(radice, { stato, vai }) {
  const visibili = ordinaPerRecenti(stato.idee.filter((i) => inScheda(i, stato.scheda)));
  const p = pagina(visibili, stato.pagina);
  stato.pagina = p.numero;

  radice.innerHTML = `
    <header class="barra">
      <span id="indicatore" class="indicatore">…</span>
      <button class="icona-btn" data-azione="impostazioni" aria-label="Impostazioni">${ICONE.ingranaggio}</button>
    </header>

    <button class="occhio" id="mic" aria-label="Parla: racconta una nuova idea">
      <span class="anello">${ICONE.microfono}</span>
    </button>
    <div class="etichetta-occhio">Parla</div>
    <p class="sottotitolo">Tieni premuto e racconta una nuova idea</p>

    <form class="riga-input" id="form-testo">
      <input id="testo" placeholder="…oppure scrivi qui" autocomplete="off" aria-label="Scrivi una nuova idea">
      <button class="pillola viola" type="submit">Invia</button>
    </form>

    <nav class="schede" role="tablist">
      ${Object.values(SCHEDE)
        .map((s) => `<button role="tab" data-scheda="${s}" aria-selected="${s === stato.scheda}">${NOMI_SCHEDE[s]}</button>`)
        .join('')}
    </nav>

    <div class="riga-titolo"><span>Le tue idee</span><span>Pagina ${p.numero} di ${p.totalePagine}</span></div>
    ${p.elementi.length ? `<ul class="lista">${p.elementi.map(schedaIdea).join('')}</ul>` : `<p class="vuota">${VUOTE[stato.scheda]}</p>`}

    <div class="paginazione">
      <button class="pillola grigia" data-pagina="-1" ${p.numero === 1 ? 'disabled' : ''}>Più recenti</button>
      <button class="pillola grigia" data-pagina="1" ${p.numero === p.totalePagine ? 'disabled' : ''}>Meno recenti</button>
    </div>
  `;

  radice.querySelector('[data-azione="impostazioni"]').onclick = () => vai('impostazioni');
  radice.querySelector('#mic').onclick = () => vai('conversazione', { avviaMicrofono: true });
  radice.querySelector('#form-testo').onsubmit = (e) => {
    e.preventDefault();
    const testo = radice.querySelector('#testo').value.trim();
    if (testo) vai('conversazione', { testoIniziale: testo });
  };
  radice.querySelectorAll('[data-scheda]').forEach((b) => {
    b.onclick = () => {
      stato.scheda = b.dataset.scheda;
      stato.pagina = 1;
      vai('home');
    };
  });
  radice.querySelectorAll('[data-pagina]').forEach((b) => {
    b.onclick = () => {
      stato.pagina += Number(b.dataset.pagina);
      vai('home');
    };
  });
  radice.querySelectorAll('[data-id]').forEach((b) => {
    b.onclick = () => vai('idea', { id: b.dataset.id });
  });
}
