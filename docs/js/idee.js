// Modello di un'idea: stati, transizioni, migliorie, ordinamento e paginazione.
// Modulo puro: nessun accesso a DOM, rete o memoria. Ogni funzione restituisce
// un nuovo oggetto e non modifica quello ricevuto.

export const STATI = Object.freeze({
  IN_DISCUSSIONE: 'in_discussione',
  PRONTA: 'pronta',
  IMPOSTATA: 'impostata',
  MIGLIORIA_IN_ATTESA: 'miglioria_in_attesa',
  ARCHIVIATA: 'archiviata',
  NEL_CESTINO: 'nel_cestino',
});

export const SCHEDE = Object.freeze({
  ATTIVE: 'attive',
  ARCHIVIO: 'archivio',
  CESTINO: 'cestino',
});

// Transizioni "normali". Archivio e cestino si gestiscono a parte
// (archivia, cestina, ripristina) perché ricordano lo stato precedente.
const TRANSIZIONI = Object.freeze({
  [STATI.IN_DISCUSSIONE]: [STATI.PRONTA],
  [STATI.PRONTA]: [STATI.IN_DISCUSSIONE, STATI.IMPOSTATA],
  [STATI.IMPOSTATA]: [STATI.MIGLIORIA_IN_ATTESA],
  [STATI.MIGLIORIA_IN_ATTESA]: [STATI.IMPOSTATA],
  [STATI.ARCHIVIATA]: [],
  [STATI.NEL_CESTINO]: [],
});

const MESSI_DA_PARTE = new Set([STATI.ARCHIVIATA, STATI.NEL_CESTINO]);

const iso = (ora) => new Date(ora).toISOString();

function dataLocale(ora) {
  const d = new Date(ora);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function slugify(testo) {
  const s = String(testo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  return s || 'idea';
}

export function idIdea(titolo, ora) {
  return `${dataLocale(ora)}-${slugify(titolo)}`;
}

function titoloValido(titolo, cosa) {
  const t = String(titolo ?? '').trim();
  if (!t) throw new Error(`Il titolo ${cosa} è obbligatorio`);
  return t;
}

export function creaIdea({ titolo, ora = new Date(), etichette = [] }) {
  const t = titoloValido(titolo, "dell'idea");
  return {
    id: idIdea(t, ora),
    titolo: t,
    stato: STATI.IN_DISCUSSIONE,
    statoPrecedente: null,
    versione: 1,
    etichette: [...etichette],
    migliorie: [],
    creata: iso(ora),
    aggiornata: iso(ora),
  };
}

export function puoPassareA(idea, nuovoStato) {
  return (TRANSIZIONI[idea.stato] ?? []).includes(nuovoStato);
}

export function cambiaStato(idea, nuovoStato, ora = new Date()) {
  if (!puoPassareA(idea, nuovoStato)) {
    throw new Error(`Transizione non ammessa: ${idea.stato} → ${nuovoStato}`);
  }
  let migliorie = idea.migliorie;
  // Quando il PC applica le migliorie, vengono segnate come applicate.
  if (idea.stato === STATI.MIGLIORIA_IN_ATTESA && nuovoStato === STATI.IMPOSTATA) {
    migliorie = migliorie.map((m) => (m.applicata ? m : { ...m, applicata: iso(ora) }));
  }
  return { ...idea, stato: nuovoStato, migliorie, aggiornata: iso(ora) };
}

function mettiDaParte(idea, destinazione, ora) {
  if (idea.stato === destinazione) return idea;
  // Da archivio a cestino (o viceversa) si conserva lo stato "vivo" originale.
  const precedente = MESSI_DA_PARTE.has(idea.stato) ? idea.statoPrecedente : idea.stato;
  return { ...idea, stato: destinazione, statoPrecedente: precedente, aggiornata: iso(ora) };
}

export function archivia(idea, ora = new Date()) {
  return mettiDaParte(idea, STATI.ARCHIVIATA, ora);
}

export function cestina(idea, ora = new Date()) {
  return mettiDaParte(idea, STATI.NEL_CESTINO, ora);
}

export function ripristina(idea, ora = new Date()) {
  if (!MESSI_DA_PARTE.has(idea.stato)) {
    throw new Error(`Si possono ripristinare solo idee in archivio o nel cestino (stato: ${idea.stato})`);
  }
  return {
    ...idea,
    stato: idea.statoPrecedente ?? STATI.IN_DISCUSSIONE,
    statoPrecedente: null,
    aggiornata: iso(ora),
  };
}

// Una miglioria si aggiunge a un'idea già impostata sul PC.
// Un'idea archiviata viene riaperta automaticamente; una nel cestino no.
export function aggiungiMiglioria(idea, { titolo, ora = new Date() }) {
  const t = titoloValido(titolo, 'della miglioria');
  const base = idea.stato === STATI.ARCHIVIATA ? ripristina(idea, ora) : idea;
  if (base.stato !== STATI.IMPOSTATA && base.stato !== STATI.MIGLIORIA_IN_ATTESA) {
    throw new Error('Si possono migliorare solo idee già impostate sul PC');
  }
  const versione = base.versione + 1;
  return {
    ...base,
    versione,
    stato: STATI.MIGLIORIA_IN_ATTESA,
    migliorie: [
      ...base.migliorie,
      { versione, slug: slugify(t), titolo: t, creata: iso(ora), applicata: null },
    ],
    aggiornata: iso(ora),
  };
}

export function inScheda(idea, scheda) {
  if (scheda === SCHEDE.ARCHIVIO) return idea.stato === STATI.ARCHIVIATA;
  if (scheda === SCHEDE.CESTINO) return idea.stato === STATI.NEL_CESTINO;
  return !MESSI_DA_PARTE.has(idea.stato);
}

export function ordinaPerRecenti(idee) {
  // Le date sono ISO 8601 in UTC, quindi l'ordine alfabetico è quello cronologico.
  return [...idee].sort((a, b) => b.aggiornata.localeCompare(a.aggiornata));
}

export function pagina(lista, numero, perPagina = 4) {
  const totalePagine = Math.max(1, Math.ceil(lista.length / perPagina));
  const n = Math.min(Math.max(1, Math.trunc(numero) || 1), totalePagine);
  return {
    elementi: lista.slice((n - 1) * perPagina, n * perPagina),
    numero: n,
    totalePagine,
  };
}
