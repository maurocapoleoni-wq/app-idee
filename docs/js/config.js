// Impostazioni dell'app, salvate SOLO nel browser del telefono (localStorage).
// Nessun segreto deve mai comparire nel codice sorgente.

import { MODELLO_PREDEFINITO } from './claude.js';

const PREFISSO = 'raccoglitore-idee:';

export const CAMPI = Object.freeze([
  { chiave: 'github_owner', etichetta: 'Utente GitHub', tipo: 'text', obbligatorio: true },
  { chiave: 'github_repo', etichetta: 'Repository della cassetta', tipo: 'text', predefinito: 'cassetta-idee', obbligatorio: true },
  { chiave: 'github_token', etichetta: 'Token GitHub (fine-grained)', tipo: 'password', obbligatorio: true },
  { chiave: 'anthropic_key', etichetta: 'Chiave API Anthropic', tipo: 'password', obbligatorio: true },
  { chiave: 'modello_domande', etichetta: 'Modello per le domande', tipo: 'text', predefinito: MODELLO_PREDEFINITO },
  { chiave: 'modello_finale', etichetta: 'Modello per la scheda finale', tipo: 'text', predefinito: MODELLO_PREDEFINITO },
  { chiave: 'youtube_key', etichetta: 'Chiave YouTube Data API', tipo: 'password' },
]);

export function leggiConfig(storage = globalThis.localStorage) {
  const config = {};
  for (const campo of CAMPI) {
    config[campo.chiave] = storage?.getItem(PREFISSO + campo.chiave) || campo.predefinito || '';
  }
  return config;
}

export function salvaConfig(valori, storage = globalThis.localStorage) {
  for (const campo of CAMPI) {
    if (!(campo.chiave in valori)) continue;
    const valore = String(valori[campo.chiave] ?? '').trim();
    if (valore) storage.setItem(PREFISSO + campo.chiave, valore);
    else storage.removeItem(PREFISSO + campo.chiave);
  }
}

export function campiMancanti(config) {
  return CAMPI.filter((c) => c.obbligatorio && !config[c.chiave]).map((c) => c.etichetta);
}
