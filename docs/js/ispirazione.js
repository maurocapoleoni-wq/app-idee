// Sezione Ispirazione: ricerche YouTube su un'idea, solo su richiesta (regola 9),
// salvate per non consumare di nuovo la quota. Modulo puro: niente rete.

export const FILTRI = Object.freeze({
  esiste_gia: 'Esiste già?',
  come_si_costruisce: 'Come si costruisce',
  idee_interfaccia: "Idee per l'interfaccia",
});
export const COSTO_RICERCA = 100;
export const QUOTA_GIORNALIERA = 10000;

const iso = (ora) => new Date(ora).toISOString();

export function ispirazioneVuota() {
  return { query: null, risultati: {} };
}

// Le query arrivano da Haiku: una per filtro. Una query mancante diventa il titolo dell'idea.
export function normalizzaQuery(json, titolo) {
  const query = {};
  for (const filtro of Object.keys(FILTRI)) {
    const q = typeof json?.[filtro] === 'string' ? json[filtro].trim() : '';
    query[filtro] = q || String(titolo ?? '').trim() || 'app idea';
  }
  return query;
}

export function aggiungiRisultati(ispirazione, filtro, { query, video, ora = new Date() }) {
  if (!FILTRI[filtro]) throw new Error(`Filtro sconosciuto: ${filtro}`);
  return {
    ...ispirazione,
    risultati: { ...ispirazione.risultati, [filtro]: { query, video, cercata: iso(ora) } },
  };
}

function data(isoString) {
  const d = new Date(isoString);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ispirazione.md nella cassetta: leggibile dall'utente e dalla skill sul PC.
export function ispirazioneMd(idea, ispirazione) {
  const righe = [`# Ispirazione — ${idea.titolo}\n`];
  const fatte = Object.keys(FILTRI).filter((f) => ispirazione?.risultati?.[f]);
  if (!fatte.length) {
    righe.push("_Nessuna ricerca ancora eseguita. Le ricerche partono solo su richiesta dalla pagina dell'idea._\n");
    return righe.join('\n');
  }
  for (const filtro of fatte) {
    const r = ispirazione.risultati[filtro];
    righe.push(`## ${FILTRI[filtro]}\n`);
    righe.push(`_Ricerca YouTube: «${r.query}» · ${data(r.cercata)}_\n`);
    righe.push(r.video.length
      ? `${r.video.map((v) => `- [${v.titolo.replace(/[[\]]/g, '')}](${v.url}) — ${v.canale}`).join('\n')}\n`
      : '_Nessun video trovato._\n');
  }
  return righe.join('\n');
}

// La quota di YouTube si azzera a mezzanotte del Pacifico: il conteggio usa quella data.
export function giornoQuota(ora = new Date()) {
  return new Date(ora).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

const chiaveQuota = (ora) => `raccoglitore-idee:youtube:${giornoQuota(ora)}`;

export function unitaUsateOggi(storage = globalThis.localStorage, ora = new Date()) {
  return Number(storage?.getItem(chiaveQuota(ora)) ?? 0) || 0;
}

export function registraUnita(unita, storage = globalThis.localStorage, ora = new Date()) {
  const totale = unitaUsateOggi(storage, ora) + unita;
  storage?.setItem(chiaveQuota(ora), String(totale));
  return totale;
}
