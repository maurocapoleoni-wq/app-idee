// Ricerca tra le proprie idee e idee simili. Modulo puro: niente rete, niente Claude,
// niente costi. Funziona anche senza connessione e cerca anche in archivio e cestino.

const STOP = new Set([
  'il', 'lo', 'la', 'le', 'gli', 'un', 'una', 'uno', 'di', 'da', 'del', 'dei', 'della', 'delle', 'degli', 'dello',
  'al', 'ai', 'alla', 'alle', 'allo', 'nel', 'nei', 'nella', 'nelle', 'col', 'sul', 'sui', 'sulla', 'sulle',
  'per', 'con', 'su', 'tra', 'fra', 'che', 'chi', 'cui', 'non', 'piu', 'come', 'anche', 'oppure', 'dove', 'quando',
  'sono', 'era', 'ero', 'essere', 'ha', 'ho', 'hanno', 'fare', 'fa', 'mi', 'ti', 'si', 'ci', 'vi', 'ma', 'se', 'so',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'idea', 'app', 'applicazione', 'applicazioni',
]);

function senzaAccenti(testo) {
  return String(testo ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "sogni", "sogno" → "sogn"; "diario", "diari" → "diar". Le vocali finali cadono: basta per il confronto.
function radice(parola) {
  let r = parola;
  while (r.length > 3 && /[aeiou]$/.test(r)) r = r.slice(0, -1);
  return r;
}

export function token(testo) {
  return senzaAccenti(testo)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !STOP.has(p))
    .map(radice);
}

// Una parola cercata "combacia" con una parola del testo se ne è l'inizio: scrivendo "regis"
// si trova "registrare". Sotto le 3 lettere serve la parola intera.
const combacia = (cercata, nelTesto) => (cercata.length >= 3 ? nelTesto.startsWith(cercata) : nelTesto === cercata);

const PESI = { titolo: 5, problema: 2, utenti: 2, funzioni: 2, piattaforma: 2, note: 1, conversazione: 1 };
const NOMI = {
  titolo: 'Titolo', problema: 'Problema', utenti: 'Utenti', funzioni: 'Funzioni',
  piattaforma: 'Piattaforma', note: 'Note', conversazione: 'Conversazione',
};

// Un documento è ciò che si può cercare di un'idea. Le idee d'esempio non hanno scheda: solo titolo.
export function documentoDaIdea(idea, dialogo = null) {
  const scheda = dialogo?.scheda ?? {};
  return {
    id: idea.id,
    titolo: idea.titolo,
    stato: idea.stato,
    aggiornata: idea.aggiornata,
    campi: {
      titolo: idea.titolo,
      problema: scheda.problema ?? '',
      utenti: scheda.utenti ?? '',
      funzioni: (scheda.funzioni ?? []).join('. '),
      piattaforma: scheda.piattaforma ?? '',
      note: scheda.note ?? '',
      conversazione: (dialogo?.messaggi ?? []).filter((m) => m.ruolo === 'utente').map((m) => m.testo).join('. '),
    },
  };
}

function estratto(testo, cercate) {
  const parole = String(testo).split(/\s+/).filter(Boolean);
  const i = parole.findIndex((p) => token(p).some((t) => cercate.some((c) => combacia(c, t))));
  if (i === -1) return parole.slice(0, 10).join(' ');
  const da = Math.max(0, i - 4);
  const a = Math.min(parole.length, i + 9);
  return `${da > 0 ? '… ' : ''}${parole.slice(da, a).join(' ')}${a < parole.length ? ' …' : ''}`;
}

// Tutte le parole cercate devono comparire (E logico). Il titolo vale più del resto.
export function cerca(documenti, query) {
  const cercate = [...new Set(token(query))];
  if (!cercate.length) return [];
  const risultati = [];
  for (const doc of documenti) {
    const tokenPerCampo = Object.fromEntries(Object.entries(doc.campi).map(([k, v]) => [k, token(v)]));
    let punteggio = 0;
    let migliore = null;
    let tutte = true;
    for (const c of cercate) {
      let pesoMax = 0;
      let campoMax = null;
      for (const [campo, tokens] of Object.entries(tokenPerCampo)) {
        if (tokens.some((t) => combacia(c, t)) && (PESI[campo] ?? 1) > pesoMax) {
          pesoMax = PESI[campo] ?? 1;
          campoMax = campo;
        }
      }
      if (!pesoMax) {
        tutte = false;
        break;
      }
      punteggio += pesoMax;
      if (!migliore || pesoMax > migliore.peso) migliore = { campo: campoMax, peso: pesoMax };
    }
    if (!tutte) continue;
    risultati.push({
      id: doc.id,
      punteggio,
      campo: NOMI[migliore.campo],
      estratto: migliore.campo === 'titolo' ? '' : estratto(doc.campi[migliore.campo], cercate),
      aggiornata: doc.aggiornata,
    });
  }
  return risultati.sort((a, b) => b.punteggio - a.punteggio || b.aggiornata.localeCompare(a.aggiornata));
}

// --- Idee simili ---

const insieme = (doc) => new Set(
  ['titolo', 'problema', 'utenti', 'funzioni', 'piattaforma'].flatMap((c) => token(doc.campi[c])),
);

export const SOGLIA_SIMILE = 0.2;
export const SOGLIA_DOPPIONE = 0.45;

// Somiglianza di Jaccard sulle radici delle parole (titolo, problema, utenti, funzioni, piattaforma:
// mai note o conversazioni). Servono almeno 2 parole in comune, per non scambiare un titolo corto per un doppione.
export function simili(doc, altri, { massimo = 3 } = {}) {
  const mie = insieme(doc);
  const trovate = [];
  for (const altro of altri) {
    if (altro.id === doc.id) continue;
    const loro = insieme(altro);
    let comuni = 0;
    for (const t of mie) if (loro.has(t)) comuni += 1;
    const unione = mie.size + loro.size - comuni;
    const punteggio = unione ? comuni / unione : 0;
    if (comuni >= 2 && punteggio >= SOGLIA_SIMILE) {
      trovate.push({ id: altro.id, punteggio, doppione: punteggio >= SOGLIA_DOPPIONE });
    }
  }
  return trovate.sort((a, b) => b.punteggio - a.punteggio).slice(0, massimo);
}
