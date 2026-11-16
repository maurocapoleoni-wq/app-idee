// Coda offline: ogni salvataggio passa da qui prima di andare su GitHub.
// Regola: un elemento esce dalla coda SOLO dopo un invio riuscito.
// Nessun dato viene mai scartato in silenzio.

export function memoriaInRam(iniziale = []) {
  let dati = structuredClone(iniziale);
  return {
    async leggi() {
      return structuredClone(dati);
    },
    async scrivi(valore) {
      dati = structuredClone(valore);
    },
  };
}

// Una memoria = una chiave nello stesso database (es. 'coda', 'dialoghi').
export function memoriaIndexedDB(nomeDb = 'raccoglitore-idee', chiave = 'coda') {
  const apri = () =>
    new Promise((ok, ko) => {
      const richiesta = indexedDB.open(nomeDb, 1);
      richiesta.onupgradeneeded = () => richiesta.result.createObjectStore('kv');
      richiesta.onsuccess = () => ok(richiesta.result);
      richiesta.onerror = () => ko(richiesta.error);
    });

  const operazione = async (modo, fn) => {
    const db = await apri();
    return new Promise((ok, ko) => {
      const tx = db.transaction('kv', modo);
      const richiesta = fn(tx.objectStore('kv'));
      tx.oncomplete = () => {
        db.close();
        ok(richiesta?.result);
      };
      tx.onerror = () => {
        db.close();
        ko(tx.error);
      };
    });
  };

  return {
    async leggi() {
      return (await operazione('readonly', (s) => s.get(chiave))) ?? [];
    },
    async scrivi(valore) {
      await operazione('readwrite', (s) => s.put(valore, chiave));
    },
  };
}

// Un elemento = un salvataggio = un commit: { chiave, files: [{ percorso, contenuto }], messaggio }.
// La chiave è di solito l'id dell'idea. Accetta anche il vecchio formato a file singolo.
function normalizza(el) {
  if (Array.isArray(el.files)) return { revisione: 0, ...el };
  return { ...el, chiave: el.percorso, files: [{ percorso: el.percorso, contenuto: el.contenuto }], revisione: 0 };
}

export function creaCoda(memoria, { ora = () => new Date() } = {}) {
  let invioInCorso = null;

  const leggi = async () => (await memoria.leggi()).map(normalizza);

  async function aggiungi(nuovo) {
    const { chiave, files, messaggio } = normalizza(nuovo);
    const validi = chiave && files.length && files.every((f) => f.percorso && typeof f.contenuto === 'string');
    if (!validi) throw new Error('Elemento di coda non valido: servono chiave, percorsi e contenuti');
    const lista = await leggi();
    const esistente = lista.find((e) => e.chiave === chiave);
    if (esistente) {
      // Stessa idea già in attesa: si uniscono i file (vince la versione più nuova), la posizione resta.
      const perPercorso = new Map(esistente.files.map((f) => [f.percorso, f]));
      for (const f of files) perPercorso.set(f.percorso, { percorso: f.percorso, contenuto: f.contenuto });
      esistente.files = [...perPercorso.values()];
      esistente.messaggio = messaggio;
      esistente.aggiunto = ora().toISOString();
      esistente.revisione += 1;
    } else {
      lista.push({
        id: crypto.randomUUID(),
        chiave,
        files: files.map((f) => ({ percorso: f.percorso, contenuto: f.contenuto })),
        messaggio,
        revisione: 0,
        aggiunto: ora().toISOString(),
        tentativi: 0,
        ultimoErrore: null,
      });
    }
    await memoria.scrivi(lista);
  }

  async function elementi() {
    return leggi();
  }

  async function inAttesa() {
    return (await memoria.leggi()).length;
  }

  // Invia in ordine. Al primo errore si ferma, per non scavalcare l'ordine dei salvataggi.
  async function svuota(inviaFn) {
    let inviati = 0;
    let errore = null;
    for (;;) {
      const lista = await leggi();
      const primo = lista[0];
      if (!primo) break;
      try {
        await inviaFn(primo);
      } catch (e) {
        errore = e;
        const aggiornata = await leggi();
        const el = aggiornata.find((x) => x.id === primo.id);
        if (el) {
          el.tentativi += 1;
          el.ultimoErrore = String(e?.message ?? e);
          await memoria.scrivi(aggiornata);
        }
        break;
      }
      const aggiornata = await leggi();
      const el = aggiornata.find((x) => x.id === primo.id);
      // Se durante l'invio è arrivata una versione più nuova della stessa idea, resta in coda.
      if (el && el.revisione === primo.revisione) {
        await memoria.scrivi(aggiornata.filter((x) => x.id !== primo.id));
      }
      inviati += 1;
    }
    return { inviati, inAttesa: (await memoria.leggi()).length, errore };
  }

  function invia(inviaFn) {
    if (!invioInCorso) {
      invioInCorso = svuota(inviaFn).finally(() => {
        invioInCorso = null;
      });
    }
    return invioInCorso;
  }

  return { aggiungi, elementi, inAttesa, invia };
}
