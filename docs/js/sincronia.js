// Il telefono rilegge la cassetta: stati cambiati dal PC, idee salvate da un altro browser.
// Modulo puro: decide cosa aggiornare, non legge e non scrive nulla.

import { schedaVuota } from './dialogo.js';

const trovaLocale = (dialoghi, id) => dialoghi.find((d) => d.idea?.id === id) ?? null;

// Serve scaricare scheda e conversazione solo per idee nuove o cambiate altrove.
export function serveDettaglio(dialoghi, ideaRemota) {
  const locale = trovaLocale(dialoghi, ideaRemota.id);
  return !locale || ideaRemota.aggiornata > locale.idea.aggiornata;
}

// Regole:
// - un'idea con salvataggi ancora in coda sul telefono non si tocca (vince il telefono, che sta per inviare);
// - un'idea che il telefono non conosce entra nell'archivio locale;
// - un'idea più recente nella cassetta (es. "impostata" dal PC) aggiorna quella locale;
// - descrizioni delle migliorie e bozze locali restano.
export function unisciDaCassetta(dialoghi, remoto, { inCoda = new Set() } = {}) {
  const { idea, scheda, messaggi } = remoto;
  if (inCoda.has(idea.id)) return null;
  const locale = trovaLocale(dialoghi, idea.id);
  if (!locale) {
    return {
      chiave: `cassetta:${idea.id}`,
      idea,
      scheda: scheda ?? schedaVuota(),
      messaggi: messaggi ?? [],
      completa: false,
    };
  }
  if (!(idea.aggiornata > locale.idea.aggiornata)) return null;
  return {
    ...locale,
    idea,
    scheda: scheda ?? locale.scheda,
    // La conversazione nella cassetta ha i minuti, quella locale i millisecondi: si tiene la più lunga.
    messaggi: messaggi && messaggi.length >= locale.messaggi.length ? messaggi : locale.messaggi,
  };
}
