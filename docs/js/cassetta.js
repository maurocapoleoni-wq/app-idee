// Composizione dei file di un'idea nella cassetta (repo GitHub privato).
// Modulo puro: produce percorsi e testi, non scrive nulla.
//
// Struttura di un'idea:
//   AAAA-MM-GG-<slug>/
//     stato.json  scheda.md  conversazione.md  CLAUDE.md  ispirazione.md
//     migliorie/vN-<slug>.md

import { STATI } from './idee.js';

const STATI_VALIDI = new Set(Object.values(STATI));
const FORMATO_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function controllaId(id) {
  if (typeof id !== 'string' || !FORMATO_ID.test(id)) {
    throw new Error(`Identificativo idea non valido: ${id}`);
  }
}

export function percorsiIdea(id) {
  controllaId(id);
  return {
    cartella: id,
    stato: `${id}/stato.json`,
    scheda: `${id}/scheda.md`,
    conversazione: `${id}/conversazione.md`,
    claudeMd: `${id}/CLAUDE.md`,
    ispirazione: `${id}/ispirazione.md`,
  };
}

export function percorsoMiglioria(id, miglioria) {
  controllaId(id);
  if (!Number.isInteger(miglioria.versione) || miglioria.versione < 2) {
    throw new Error(`Versione della miglioria non valida: ${miglioria.versione}`);
  }
  return `${id}/migliorie/v${miglioria.versione}-${miglioria.slug}.md`;
}

export function statoJson(idea) {
  controllaId(idea.id);
  return JSON.stringify(idea, null, 2) + '\n';
}

export function leggiStatoJson(testo, id) {
  controllaId(id);
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error(`stato.json di ${id} non è JSON valido`);
  }
  if (!dati || typeof dati !== 'object') throw new Error(`stato.json di ${id} è vuoto`);
  if (!STATI_VALIDI.has(dati.stato)) throw new Error(`Stato sconosciuto in ${id}: ${dati.stato}`);
  if (!Number.isInteger(dati.versione) || dati.versione < 1) {
    throw new Error(`Versione non valida in ${id}: ${dati.versione}`);
  }
  if (typeof dati.titolo !== 'string' || !dati.titolo.trim()) throw new Error(`Titolo mancante in ${id}`);
  // Si conserva l'ordine dei campi del file: riscriverlo non deve sporcare il diff.
  return {
    ...dati,
    id, // la cartella è la fonte di verità per l'identificativo
    statoPrecedente: dati.statoPrecedente ?? null,
    etichette: dati.etichette ?? [],
    migliorie: dati.migliorie ?? [],
  };
}

const DA_DEFINIRE = '_da definire_';

function formattaData(isoString) {
  const d = new Date(isoString);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function sezione(titolo, valore) {
  let corpo;
  if (Array.isArray(valore)) {
    corpo = valore.length ? valore.map((v) => `- ${v}`).join('\n') : DA_DEFINIRE;
  } else {
    corpo = String(valore ?? '').trim() || DA_DEFINIRE;
  }
  return `## ${titolo}\n\n${corpo}\n`;
}

export function schedaMd(idea, scheda = {}) {
  return [
    `# ${idea.titolo}\n`,
    `Versione ${idea.versione} · aggiornata ${formattaData(idea.aggiornata)}\n`,
    sezione('Problema', scheda.problema),
    sezione('Utenti', scheda.utenti),
    sezione('Funzioni', scheda.funzioni ?? []),
    sezione('Piattaforma', scheda.piattaforma),
    sezione('Note', scheda.note),
  ].join('\n');
}

// Ciò che può uscire dal telefono quando si condivide (regola 8): titolo e sezioni pubbliche
// della scheda. Mai le Note, mai le conversazioni, mai lo stato o le migliorie.
export function schedaPerCondividere(idea, scheda = {}) {
  const parti = [`# ${idea.titolo}`];
  const testo = (v) => String(v ?? '').trim();
  if (testo(scheda.problema)) parti.push(`## Problema\n\n${testo(scheda.problema)}`);
  if (testo(scheda.utenti)) parti.push(`## Utenti\n\n${testo(scheda.utenti)}`);
  if (scheda.funzioni?.length) parti.push(`## Funzioni\n\n${scheda.funzioni.map((f) => `- ${f}`).join('\n')}`);
  if (testo(scheda.piattaforma)) parti.push(`## Piattaforma\n\n${testo(scheda.piattaforma)}`);
  return `${parti.join('\n\n')}\n`;
}

const NOMI_RUOLO = { app: 'App', utente: 'Tu' };

export function conversazioneMd(idea, messaggi = []) {
  const righe = [`# Conversazione — ${idea.titolo}\n`];
  for (const m of messaggi) {
    const chi = NOMI_RUOLO[m.ruolo];
    if (!chi) throw new Error(`Ruolo sconosciuto nella conversazione: ${m.ruolo}`);
    righe.push(`### ${chi} · ${formattaData(m.ora)}\n\n${String(m.testo ?? '').trim()}\n`);
  }
  return righe.join('\n');
}

export function migliorieMd(idea, miglioria, descrizione = '', messaggi = []) {
  const parti = [
    `# Miglioria v${miglioria.versione} — ${miglioria.titolo}\n`,
    `Idea: ${idea.titolo} · creata ${formattaData(miglioria.creata)}\n`,
    sezione('Cosa cambia e perché', descrizione),
  ];
  if (messaggi.length) {
    parti.push('## Conversazione\n');
    for (const m of messaggi) {
      const chi = NOMI_RUOLO[m.ruolo];
      if (!chi) throw new Error(`Ruolo sconosciuto nella conversazione: ${m.ruolo}`);
      parti.push(`### ${chi} · ${formattaData(m.ora)}\n\n${String(m.testo ?? '').trim()}\n`);
    }
  }
  return parti.join('\n');
}

// --- Lettura dei file scritti sopra (il telefono rilegge la cassetta) ---

const SEZIONI_SCHEDA = { Problema: 'problema', Utenti: 'utenti', Funzioni: 'funzioni', Piattaforma: 'piattaforma', Note: 'note' };

export function leggiSchedaMd(testo) {
  const scheda = { problema: '', utenti: '', funzioni: [], piattaforma: '', note: '' };
  const blocchi = String(testo ?? '').replace(/\r\n/g, '\n').split(/^## /m).slice(1);
  for (const blocco of blocchi) {
    const a = blocco.indexOf('\n');
    const titolo = (a === -1 ? blocco : blocco.slice(0, a)).trim();
    const chiave = SEZIONI_SCHEDA[titolo];
    if (!chiave) continue;
    const corpo = (a === -1 ? '' : blocco.slice(a + 1)).trim();
    if (!corpo || corpo === DA_DEFINIRE) continue;
    scheda[chiave] = chiave === 'funzioni'
      ? corpo.split('\n').map((r) => r.replace(/^\s*-\s+/, '').trim()).filter(Boolean)
      : corpo;
  }
  return scheda;
}

const RUOLO_DA_NOME = { App: 'app', Tu: 'utente' };

export function leggiConversazioneMd(testo) {
  const messaggi = [];
  const parti = String(testo ?? '').replace(/\r\n/g, '\n').split(/^### (App|Tu) · (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\n/m);
  // parti: [intestazione, chi, a, m, g, h, min, testo, chi, ...]
  for (let i = 1; i + 6 < parti.length; i += 7) {
    const [chi, a, m, g, h, min, corpo] = parti.slice(i, i + 7);
    const testoMsg = corpo.trim();
    if (!testoMsg) continue;
    messaggi.push({
      ruolo: RUOLO_DA_NOME[chi],
      testo: testoMsg,
      ora: new Date(Number(a), Number(m) - 1, Number(g), Number(h), Number(min)).toISOString(),
    });
  }
  return messaggi;
}

export function messaggioCommit(idea, azione) {
  return `${azione}: ${idea.titolo} (v${idea.versione})`;
}

// Elenco dei file da scrivere per un salvataggio dell'idea.
export function fileDiSalvataggio(idea, { scheda, messaggi } = {}) {
  const p = percorsiIdea(idea.id);
  const file = [{ percorso: p.stato, contenuto: statoJson(idea) }];
  if (scheda) file.push({ percorso: p.scheda, contenuto: schedaMd(idea, scheda) });
  if (messaggi) file.push({ percorso: p.conversazione, contenuto: conversazioneMd(idea, messaggi) });
  return file;
}
