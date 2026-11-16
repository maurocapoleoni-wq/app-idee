import { STATI } from '../idee.js';
import { ICONE } from './dom.js';

// Colore e icona di ogni stato, come concordato: arancione in discussione,
// verde pronta, blu impostata sul PC.
export const STILE_STATO = Object.freeze({
  [STATI.IN_DISCUSSIONE]: { nome: 'In discussione', colore: '#ba7517', fondo: '#633806', testo: '#fac775', icona: ICONE.messaggio },
  [STATI.PRONTA]: { nome: 'Pronta', colore: '#1d9e75', fondo: '#085041', testo: '#9fe1cb', icona: ICONE.spunta },
  [STATI.IMPOSTATA]: { nome: 'Impostata sul PC', colore: '#378add', fondo: '#0c447c', testo: '#b5d4f4', icona: ICONE.computer },
  [STATI.MIGLIORIA_IN_ATTESA]: { nome: 'Miglioria in attesa', colore: '#378add', fondo: '#633806', testo: '#fac775', icona: ICONE.matita },
  [STATI.ARCHIVIATA]: { nome: 'Archiviata', colore: '#5f5e5a', fondo: '#444441', testo: '#d3d1c7', icona: ICONE.scatola },
  [STATI.NEL_CESTINO]: { nome: 'Nel cestino', colore: '#5f5e5a', fondo: '#501313', testo: '#f7c1c1', icona: ICONE.cestino },
});

export function badge(stato) {
  const s = STILE_STATO[stato];
  return `<span class="badge" style="background:${s.fondo};color:${s.testo}">${s.nome}</span>`;
}
