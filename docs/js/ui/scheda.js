// Vista della scheda di un'idea, condivisa da conversazione e pagina idea.

import { esc } from './dom.js';

export function schedaHtml(scheda) {
  const riga = (nome, valore) =>
    `<p><strong>${nome}:</strong> ${valore ? esc(valore) : '<em>da definire</em>'}</p>`;
  return `
    ${riga('Problema', scheda.problema)}
    ${riga('Utenti', scheda.utenti)}
    ${riga('Funzioni', (scheda.funzioni ?? []).join(' · '))}
    ${riga('Piattaforma', scheda.piattaforma)}
    ${scheda.note ? riga('Note', scheda.note) : ''}`;
}
