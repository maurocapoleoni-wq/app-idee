// Microfono + campo di testo + bozza, condivisi da conversazione e miglioria.
// Tocca il microfono per parlare, toccalo di nuovo per inviare. Il testo dettato
// resta come bozza nel telefono finché non viene inviato (regola 2).

import { voceSupportata, creaRiconoscimento } from '../voce.js';

export function collegaDettatura({ mic, etichetta, campo, form, chiaveBozza, libero, onInvia, onAvviso, onCambio }) {
  let ascolto = null;
  let inviaAllaFine = false;
  campo.value = localStorage.getItem(chiaveBozza) ?? '';

  function aggiorna() {
    mic.classList.toggle('ascolta', Boolean(ascolto));
    etichetta.textContent = ascolto ? 'Ti ascolto… tocca per inviare' : 'Tocca per parlare';
  }

  function invia() {
    const t = campo.value.trim();
    if (!t || !libero()) return;
    campo.value = '';
    localStorage.removeItem(chiaveBozza);
    onInvia(t);
  }

  function avvia() {
    if (!voceSupportata()) {
      onAvviso('Questo browser non supporta il microfono: scrivi qui sotto (su Android usa Chrome).');
      return;
    }
    globalThis.speechSynthesis?.cancel();
    let dettato = campo.value.trim() ? `${campo.value.trim()} ` : '';
    inviaAllaFine = false;
    try {
      ascolto = creaRiconoscimento({
        onParziale: (p) => { campo.value = dettato + p; },
        onFinale: (f) => {
          dettato += `${f} `;
          campo.value = dettato;
          localStorage.setItem(chiaveBozza, campo.value);
        },
        onErrore: (e) => {
          if (/no-speech|aborted/.test(e.message)) return;
          onAvviso(/not-allowed|service-not-allowed/.test(e.message)
            ? 'Il permesso del microfono è negato: abilitalo nelle impostazioni del browser per questo sito.'
            : `${e.message}. Puoi scrivere qui sotto.`);
        },
        onFine: () => {
          ascolto = null;
          aggiorna();
          onCambio();
          if (inviaAllaFine) invia();
        },
      });
      ascolto.avvia();
    } catch (e) {
      ascolto = null;
      onAvviso(e.message);
    }
    aggiorna();
    onCambio();
  }

  function fermaEInvia() {
    inviaAllaFine = true;
    ascolto.ferma();
  }

  mic.onclick = () => {
    if (ascolto) fermaEInvia();
    else if (libero()) avvia();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    if (ascolto) fermaEInvia();
    else invia();
  };
  campo.oninput = () => localStorage.setItem(chiaveBozza, campo.value);
  aggiorna();

  return {
    avvia,
    ferma: () => {
      inviaAllaFine = false;
      ascolto?.ferma();
    },
  };
}
