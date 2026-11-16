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

export function memoriaIndexedDB(nomeDb = 'raccoglitore-idee') {
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
      return (await operazione('readonly', (s) => s.get('coda'))) ?? [];
    },
    async scrivi(valore) {
      await operazione('readwrite', (s) => s.put(valore, 'coda'));
    },
  };
}

export function creaCoda(memoria, { ora = () => new Date() } = {}) {
  let invioInCorso = null;

  async function aggiungi({ percorso, contenuto, messaggio }) {
    if (!percorso || typeof contenuto !== 'string') {
      throw new Error('Elemento di coda non valido: servono percorso e contenuto');
    }
    const lista = await memoria.leggi();
    const esistente = lista.find((e) => e.percorso === percorso);
    if (esistente) {
      // Stesso file già in attesa: vale l'ultima versione, la posizione resta.
      esistente.contenuto = contenuto;
      esistente.messaggio = messaggio;
      esistente.aggiunto = ora().toISOString();
    } else {
      lista.push({
        id: crypto.randomUUID(),
        percorso,
        contenuto,
        messaggio,
        aggiunto: ora().toISOString(),
        tentativi: 0,
        ultimoErrore: null,
      });
    }
    await memoria.scrivi(lista);
  }

  async function elementi() {
    return memoria.leggi();
  }

  async function inAttesa() {
    return (await memoria.leggi()).length;
  }

  // Invia in ordine. Al primo errore si ferma, per non scavalcare l'ordine dei salvataggi.
  async function svuota(inviaFn) {
    let inviati = 0;
    let errore = null;
    for (;;) {
      const lista = await memoria.leggi();
      const primo = lista[0];
      if (!primo) break;
      try {
        await inviaFn(primo);
      } catch (e) {
        errore = e;
        const aggiornata = await memoria.leggi();
        const el = aggiornata.find((x) => x.id === primo.id);
        if (el) {
          el.tentativi += 1;
          el.ultimoErrore = String(e?.message ?? e);
          await memoria.scrivi(aggiornata);
        }
        break;
      }
      const aggiornata = await memoria.leggi();
      const el = aggiornata.find((x) => x.id === primo.id);
      // Se durante l'invio è arrivata una versione più nuova dello stesso file, resta in coda.
      if (el && el.contenuto === primo.contenuto && el.messaggio === primo.messaggio) {
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
