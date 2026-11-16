// Logica pura della conversazione con Haiku: messaggi, scheda, titolo e idea.
// Nessun accesso a DOM, rete o memoria. Ogni funzione restituisce un nuovo oggetto.

import { creaIdea, aggiungiMiglioria, STATI } from './idee.js';
import { fileDiSalvataggio, messaggioCommit, migliorieMd, percorsoMiglioria } from './cassetta.js';

const CAMPI_TESTO = ['problema', 'utenti', 'piattaforma', 'note'];
const RUOLI = new Set(['app', 'utente']);

const iso = (ora) => new Date(ora).toISOString();

export function schedaVuota() {
  return { problema: '', utenti: '', funzioni: [], piattaforma: '', note: '' };
}

// Un dialogo nasce senza idea: l'idea (e quindi la cartella nella cassetta)
// si crea dopo la prima risposta di Claude, così il titolo è già sensato.
export function nuovoDialogo(chiave) {
  if (!chiave) throw new Error('Serve una chiave per il dialogo');
  return { chiave, idea: null, scheda: schedaVuota(), messaggi: [], completa: false };
}

export function aggiungiMessaggio(dialogo, ruolo, testo, ora = new Date()) {
  if (!RUOLI.has(ruolo)) throw new Error(`Ruolo sconosciuto: ${ruolo}`);
  const t = String(testo ?? '').trim();
  if (!t) throw new Error('Il messaggio è vuoto');
  return {
    ...dialogo,
    messaggi: [...dialogo.messaggi, { ruolo, testo: t, ora: iso(ora) }],
    idea: dialogo.idea ? { ...dialogo.idea, aggiornata: iso(ora) } : null,
  };
}

// La risposta è in attesa quando l'ultimo messaggio è dell'utente.
export function attendeDomanda(dialogo) {
  return dialogo.messaggi.at(-1)?.ruolo === 'utente';
}

function comeTesto(valore) {
  if (typeof valore === 'string') return valore.trim();
  if (Array.isArray(valore)) return valore.map((v) => String(v).trim()).filter(Boolean).join(', ');
  return '';
}

// Rende robusta la risposta JSON di Claude: tipi sbagliati diventano vuoti, mai errori silenziosi.
export function normalizzaRisposta(json) {
  if (!json || typeof json !== 'object') throw new Error('Risposta di Claude non valida');
  const domanda = comeTesto(json.domanda);
  if (!domanda) throw new Error('Claude non ha fatto nessuna domanda');
  const s = json.scheda && typeof json.scheda === 'object' ? json.scheda : {};
  let funzioni = [];
  if (Array.isArray(s.funzioni)) funzioni = s.funzioni.map((f) => String(f).trim()).filter(Boolean);
  else if (typeof s.funzioni === 'string' && s.funzioni.trim()) funzioni = [s.funzioni.trim()];
  return {
    domanda,
    completa: json.completa === true,
    titolo: comeTesto(json.titolo).slice(0, 80),
    scheda: {
      problema: comeTesto(s.problema),
      utenti: comeTesto(s.utenti),
      funzioni,
      piattaforma: comeTesto(s.piattaforma),
      note: comeTesto(s.note),
    },
  };
}

// Un campo già noto non viene cancellato da una risposta che lo lascia vuoto.
export function unisciScheda(vecchia, nuova) {
  const r = { ...schedaVuota(), ...vecchia };
  for (const k of CAMPI_TESTO) if (nuova[k]) r[k] = nuova[k];
  if (nuova.funzioni?.length) r.funzioni = [...nuova.funzioni];
  return r;
}

// Sezioni che la skill sul PC si aspetta compilate prima di impostare il progetto.
const ESSENZIALI = [['problema', 'Problema'], ['utenti', 'Utenti'], ['funzioni', 'Funzioni'], ['piattaforma', 'Piattaforma']];

export function sezioniMancanti(scheda = {}) {
  return ESSENZIALI
    .filter(([k]) => (Array.isArray(scheda[k]) ? scheda[k].length === 0 : !String(scheda[k] ?? '').trim()))
    .map(([, nome]) => nome);
}

export function titoloProvvisorio(testo) {
  const t = String(testo ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .slice(0, 60)
    .replace(/[.,;:!?]+$/, '');
  return t ? t[0].toUpperCase() + t.slice(1) : 'Nuova idea';
}

// Due idee con lo stesso titolo nello stesso giorno non devono finire nella stessa cartella.
export function idUnico(id, esistenti = []) {
  const usati = new Set(esistenti);
  if (!usati.has(id)) return id;
  for (let n = 2; ; n += 1) {
    const candidato = `${id}-${n}`;
    if (!usati.has(candidato)) return candidato;
  }
}

export function assicuraIdea(dialogo, { titolo, idEsistenti = [], ora = new Date() } = {}) {
  if (dialogo.idea) return dialogo;
  const primo = dialogo.messaggi.find((m) => m.ruolo === 'utente')?.testo;
  const t = String(titolo ?? '').trim() || titoloProvvisorio(primo);
  const idea = creaIdea({ titolo: t, ora });
  return { ...dialogo, idea: { ...idea, id: idUnico(idea.id, idEsistenti) } };
}

// Applica una risposta normalizzata: aggiunge la domanda, aggiorna scheda e titolo.
// L'id dell'idea non cambia mai, anche se cambia il titolo.
export function applicaRisposta(dialogo, risposta, ora = new Date()) {
  const d = aggiungiMessaggio(dialogo, 'app', risposta.domanda, ora);
  const idea = d.idea && risposta.titolo ? { ...d.idea, titolo: risposta.titolo } : d.idea;
  return { ...d, idea, scheda: unisciScheda(d.scheda, risposta.scheda), completa: risposta.completa };
}

// --- Migliorie: una breve conversazione su un'idea già impostata sul PC ---

export function iniziaMiglioria(dialogo) {
  if (dialogo.bozzaMiglioria) return dialogo;
  return { ...dialogo, bozzaMiglioria: { messaggi: [], titolo: '', descrizione: '', completa: false } };
}

export function aggiungiMessaggioMiglioria(dialogo, ruolo, testo, ora = new Date()) {
  if (!dialogo.bozzaMiglioria) throw new Error('Nessuna miglioria in corso');
  if (!RUOLI.has(ruolo)) throw new Error(`Ruolo sconosciuto: ${ruolo}`);
  const t = String(testo ?? '').trim();
  if (!t) throw new Error('Il messaggio è vuoto');
  const b = dialogo.bozzaMiglioria;
  return { ...dialogo, bozzaMiglioria: { ...b, messaggi: [...b.messaggi, { ruolo, testo: t, ora: iso(ora) }] } };
}

export function attendeDomandaMiglioria(dialogo) {
  return dialogo.bozzaMiglioria?.messaggi.at(-1)?.ruolo === 'utente';
}

export function normalizzaRispostaMiglioria(json) {
  if (!json || typeof json !== 'object') throw new Error('Risposta di Claude non valida');
  const domanda = comeTesto(json.domanda);
  if (!domanda) throw new Error('Claude non ha fatto nessuna domanda');
  return {
    domanda,
    completa: json.completa === true,
    titolo: comeTesto(json.titolo).slice(0, 80),
    descrizione: comeTesto(json.descrizione),
  };
}

export function applicaRispostaMiglioria(dialogo, risposta, ora = new Date()) {
  const d = aggiungiMessaggioMiglioria(dialogo, 'app', risposta.domanda, ora);
  const b = d.bozzaMiglioria;
  return {
    ...d,
    bozzaMiglioria: {
      ...b,
      titolo: risposta.titolo || b.titolo,
      descrizione: risposta.descrizione || b.descrizione,
      completa: risposta.completa,
    },
  };
}

// Trasforma la bozza in una miglioria vera: versione +1, stato "miglioria in attesa".
export function salvaMiglioria(dialogo, ora = new Date()) {
  const b = dialogo.bozzaMiglioria;
  const primo = b?.messaggi.find((m) => m.ruolo === 'utente')?.testo;
  if (!primo) throw new Error('Racconta prima la miglioria');
  const titolo = b.titolo || titoloProvvisorio(primo);
  const idea = aggiungiMiglioria(dialogo.idea, { titolo, ora });
  const descrizione = b.descrizione || b.messaggi.filter((m) => m.ruolo === 'utente').map((m) => m.testo).join('\n\n');
  return {
    ...dialogo,
    idea,
    migliorie: { ...(dialogo.migliorie ?? {}), [idea.versione]: { descrizione, messaggi: b.messaggi } },
    bozzaMiglioria: null,
  };
}

const AZIONI = {
  [STATI.IN_DISCUSSIONE]: 'Idea in discussione',
  [STATI.PRONTA]: 'Idea pronta',
  [STATI.MIGLIORIA_IN_ATTESA]: 'Nuova miglioria',
  [STATI.ARCHIVIATA]: 'Archiviata',
  [STATI.NEL_CESTINO]: 'Nel cestino',
};

// Un salvataggio da mettere in coda = un commit con tutti i file dell'idea.
// Senza idea non c'è ancora una cartella nella cassetta.
// soloStato: archivio, cestino e ripristino cambiano SOLO stato.json (regola 4).
export function salvataggioDelDialogo(dialogo, { soloStato = false, azione } = {}) {
  if (!dialogo.idea) return null;
  const { idea } = dialogo;
  const messaggio = messaggioCommit(idea, azione ?? AZIONI[idea.stato] ?? 'Aggiorna idea');
  if (soloStato) return { chiave: idea.id, files: fileDiSalvataggio(idea), messaggio };
  const files = fileDiSalvataggio(idea, { scheda: dialogo.scheda, messaggi: dialogo.messaggi });
  for (const m of idea.migliorie) {
    const locale = dialogo.migliorie?.[m.versione];
    // Le migliorie arrivate dalla cassetta hanno già il loro file: non si riscrivono.
    if (locale) files.push({ percorso: percorsoMiglioria(idea.id, m), contenuto: migliorieMd(idea, m, locale.descrizione, locale.messaggi) });
  }
  return { chiave: idea.id, files, messaggio };
}
